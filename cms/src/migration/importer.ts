/**
 * importer.ts — Sudačka Mreža data-migration importer
 *
 * Reads JSON files produced by scraper.ts and inserts records into the
 * Payload CMS database via the Payload Local API (no HTTP server required).
 *
 * Import order respects Payload relationships:
 *   courts → state-attorneys → bankruptcy-admins → experts → interpreters
 *   → bankruptcy-listings → court-decisions
 *
 * Duplicate handling:
 *   - Courts, experts, interpreters, state-attorneys, bankruptcy-admins:
 *     checked by normalised name (case/diacritic-insensitive).
 *   - Court decisions and bankruptcy listings: checked by caseNumber.
 *   - Bankruptcy sales: checked by title + deadline combination.
 *
 * Usage:
 *   npx tsx src/migration/importer.ts
 *   npm run migrate:import
 *
 * Env vars (all optional):
 *   IMPORT_DRY_RUN  'true' — log actions but do not write to DB (default: false)
 *   IMPORT_BATCH    batch size for progress logging               (default: 50)
 */

import { getPayload, type Payload } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import type {
  ScrapedCourt,
  ScrapedExpert,
  ScrapedInterpreter,
  ScrapedStateAttorney,
  ScrapedDecision,
  ScrapedBankruptcyAdmin,
  ScrapedBankruptcyListing,
  ScrapedBankruptcySale,
} from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DRY_RUN = process.env.IMPORT_DRY_RUN === 'true'
const BATCH_SIZE = parseInt(process.env.IMPORT_BATCH ?? '50', 10)
const RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 1000

// ─── utilities ────────────────────────────────────────────────────────────────

function loadJson<T>(dataDir: string, filename: string): T[] {
  const fp = path.join(dataDir, filename)
  if (!fs.existsSync(fp)) {
    console.warn(`  ! ${filename} not found — skipping`)
    return []
  }
  return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T[]
}

/** Lowercase + strip diacritics for fuzzy name matching. */
function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPayload = any

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: Error | undefined
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err as Error
      if (attempt < RETRY_ATTEMPTS) {
        console.warn(`    retry ${attempt}/${RETRY_ATTEMPTS - 1} for ${label}: ${lastErr.message}`)
        await sleep(RETRY_DELAY_MS)
      }
    }
  }
  throw lastErr
}

async function findByField(
  payload: Payload,
  collection: string,
  field: string,
  value: string,
): Promise<AnyPayload | null> {
  const result = await (payload as AnyPayload).find({
    collection,
    where: { [field]: { equals: value } },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as AnyPayload) ?? null
}

async function findByName(
  payload: Payload,
  collection: string,
  name: string,
): Promise<AnyPayload | null> {
  // Exact match first
  const exact = await findByField(payload, collection, 'name', name)
  if (exact) return exact
  // Fallback: case-insensitive via like
  const result = await (payload as AnyPayload).find({
    collection,
    where: { name: { like: name } },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as AnyPayload) ?? null
}

// ─── court type mapping ───────────────────────────────────────────────────────

const COURT_TYPE_VALUES = new Set([
  'municipal', 'county', 'commercial', 'misdemeanour',
  'high_commercial', 'supreme', 'administrative', 'constitutional',
])

const COURT_TYPE_MAP: Record<string, string> = {
  'opcinski sud': 'municipal',
  'zupanijski sud': 'county',
  'trgovacki sud': 'commercial',
  'prekrsajni sud': 'misdemeanour',
  'visoki trgovacki sud': 'high_commercial',
  'vrhovni sud': 'supreme',
  'upravni sud': 'administrative',
  'ustavni sud': 'constitutional',
}

function resolveCourtType(raw: string): string {
  if (COURT_TYPE_VALUES.has(raw)) return raw
  const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [k, v] of Object.entries(COURT_TYPE_MAP)) {
    if (n.includes(k)) return v
  }
  return 'municipal'
}

// ─── decision type mapping ────────────────────────────────────────────────────

const DECISION_TYPE_VALUES = new Set([
  'civil', 'criminal', 'commercial', 'administrative', 'constitutional', 'ecj', 'ecthr',
])
const DECISION_TYPE_MAP: Record<string, string> = {
  gradjansko: 'civil', gradjansku: 'civil',
  kazneno: 'criminal', kaznenoj: 'criminal',
  trgovacko: 'commercial',
  upravno: 'administrative',
  ustavno: 'constitutional',
  ecj: 'ecj', ecthr: 'ecthr',
}

function resolveDecisionType(raw: string): string {
  if (DECISION_TYPE_VALUES.has(raw)) return raw
  const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [k, v] of Object.entries(DECISION_TYPE_MAP)) {
    if (n.includes(k)) return v
  }
  return 'civil'
}

// ─── summary tracker ─────────────────────────────────────────────────────────

interface CollectionStats {
  collection: string
  created: number
  skipped: number
  errors: number
}

// ─── 1. courts ────────────────────────────────────────────────────────────────

/** Returns a map of normKey(name) → Payload record ID. */
async function importCourts(
  payload: Payload,
  courts: ScrapedCourt[],
): Promise<{ idMap: Map<string, string>; stats: CollectionStats }> {
  console.log(`\nImporting courts (${courts.length} records)...`)
  const idMap = new Map<string, string>()
  let created = 0, skipped = 0, errors = 0

  for (const [i, court] of courts.entries()) {
    try {
      const existing = await findByName(payload, 'courts', court.name)
      if (existing) {
        idMap.set(normKey(court.name), String(existing.id))
        skipped++
      } else {
        if (!DRY_RUN) {
          const rec = await withRetry(() =>
            (payload as AnyPayload).create({
              collection: 'courts',
              data: {
                name: court.name,
                type: resolveCourtType(court.type),
                address: court.address,
                city: court.city,
                county: court.county,
                phone: court.phone,
                fax: court.fax,
                email: court.email,
                website: court.website,
                president: court.president,
              },
            }),
          `courts[${i}] "${court.name}"`)
          idMap.set(normKey(court.name), String(rec.id))
        }
        created++
      }
    } catch (err) {
      console.error(`    courts[${i}] "${court.name}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${courts.length} (created ${created}, skipped ${skipped}, errors ${errors})`)
    }
  }

  console.log(`  courts: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { idMap, stats: { collection: 'courts', created, skipped, errors } }
}

// ─── 2. state attorneys ───────────────────────────────────────────────────────

async function importStateAttorneys(
  payload: Payload,
  records: ScrapedStateAttorney[],
): Promise<CollectionStats> {
  console.log(`\nImporting state attorneys (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByName(payload, 'state-attorneys', rec.name)
      if (existing) { skipped++; continue }
      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'state-attorneys',
            data: {
              name: rec.name,
              address: rec.address,
              city: rec.city,
              county: rec.county,
              phone: rec.phone,
              fax: rec.fax,
              email: rec.email,
            },
          }),
        `state-attorneys[${i}] "${rec.name}"`)
      }
      created++
    } catch (err) {
      console.error(`    state-attorneys[${i}] "${rec.name}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  state-attorneys: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'state-attorneys', created, skipped, errors }
}

// ─── 3. bankruptcy administrators ────────────────────────────────────────────

async function importBankruptcyAdmins(
  payload: Payload,
  records: ScrapedBankruptcyAdmin[],
): Promise<{ idMap: Map<string, string>; stats: CollectionStats }> {
  console.log(`\nImporting bankruptcy administrators (${records.length} records)...`)
  const idMap = new Map<string, string>()
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByName(payload, 'bankruptcy-administrators', rec.name)
      if (existing) {
        idMap.set(normKey(rec.name), String(existing.id))
        skipped++
        continue
      }
      if (!DRY_RUN) {
        const createdRec = await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'bankruptcy-administrators',
            data: {
              name: rec.name,
              licenceNumber: rec.licenceNumber,
              phone: rec.phone,
              email: rec.email,
              address: rec.address,
              city: rec.city,
              county: rec.county,
            },
          }),
        `bankruptcy-administrators[${i}] "${rec.name}"`)
        idMap.set(normKey(rec.name), String(createdRec.id))
      }
      created++
    } catch (err) {
      console.error(`    bankruptcy-administrators[${i}] "${rec.name}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  bankruptcy-administrators: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { idMap, stats: { collection: 'bankruptcy-administrators', created, skipped, errors } }
}

// ─── 4. expert witnesses ──────────────────────────────────────────────────────

async function importExperts(
  payload: Payload,
  records: ScrapedExpert[],
  courtIdMap: Map<string, string>,
): Promise<CollectionStats> {
  console.log(`\nImporting expert witnesses (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByName(payload, 'expert-witnesses', rec.name)
      if (existing) { skipped++; continue }

      // Resolve court IDs — skip courts that weren't imported
      const assignedCourts = rec.courtNames
        .map(cn => courtIdMap.get(normKey(cn)))
        .filter((id): id is string => id !== undefined)

      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'expert-witnesses',
            data: {
              name: rec.name,
              specialityAreas: rec.specialityAreas.map(a => ({ area: a })),
              languages: rec.languages.map(l => ({ language: l })),
              county: rec.county,
              city: rec.city,
              phone: rec.phone,
              email: rec.email,
              verified: false,
              assignedCourts: assignedCourts.length > 0 ? assignedCourts : undefined,
              lang: 'hr',
            },
          }),
        `expert-witnesses[${i}] "${rec.name}"`)
      }
      created++
    } catch (err) {
      console.error(`    expert-witnesses[${i}] "${rec.name}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  expert-witnesses: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'expert-witnesses', created, skipped, errors }
}

// ─── 5. interpreters ─────────────────────────────────────────────────────────

async function importInterpreters(
  payload: Payload,
  records: ScrapedInterpreter[],
  courtIdMap: Map<string, string>,
): Promise<CollectionStats> {
  console.log(`\nImporting interpreters (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByName(payload, 'interpreters', rec.name)
      if (existing) { skipped++; continue }

      const assignedCourts = rec.courtNames
        .map(cn => courtIdMap.get(normKey(cn)))
        .filter((id): id is string => id !== undefined)

      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'interpreters',
            data: {
              name: rec.name,
              languagePairs: rec.languagePairs.map(p => ({ pair: p })),
              county: rec.county,
              city: rec.city,
              phone: rec.phone,
              email: rec.email,
              verified: false,
              assignedCourts: assignedCourts.length > 0 ? assignedCourts : undefined,
              lang: 'hr',
            },
          }),
        `interpreters[${i}] "${rec.name}"`)
      }
      created++
    } catch (err) {
      console.error(`    interpreters[${i}] "${rec.name}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  interpreters: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'interpreters', created, skipped, errors }
}

// ─── 6. bankruptcy listings ───────────────────────────────────────────────────

async function importBankruptcyListings(
  payload: Payload,
  records: ScrapedBankruptcyListing[],
  courtIdMap: Map<string, string>,
  adminIdMap: Map<string, string>,
): Promise<CollectionStats> {
  console.log(`\nImporting bankruptcy listings (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByField(payload, 'bankruptcy-listings', 'caseNumber', rec.caseNumber)
      if (existing) { skipped++; continue }

      const courtId = courtIdMap.get(normKey(rec.courtName))
      if (!courtId) {
        console.warn(`    ! bankruptcy-listings: no court for "${rec.courtName}" (case ${rec.caseNumber})`)
        errors++
        continue
      }

      const adminId = rec.administratorName
        ? adminIdMap.get(normKey(rec.administratorName))
        : undefined

      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'bankruptcy-listings',
            data: {
              caseNumber: rec.caseNumber,
              debtorName: rec.debtorName,
              court: courtId,
              administrator: adminId,
              deadline: rec.deadline,
              status: rec.status,
              publishedAt: rec.publishedAt,
              contactEmail: rec.contactEmail,
              contactPhone: rec.contactPhone,
            },
          }),
        `bankruptcy-listings[${i}] "${rec.caseNumber}"`)
      }
      created++
    } catch (err) {
      console.error(`    bankruptcy-listings[${i}] "${rec.caseNumber}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  bankruptcy-listings: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'bankruptcy-listings', created, skipped, errors }
}

// ─── 7. bankruptcy sales ──────────────────────────────────────────────────────
//
// NOTE: The Payload CMS does not yet have a dedicated 'bankruptcy-sales'
// collection — these are tracked as bankruptcy listings with a different status.
// If a dedicated collection is added later, update the slug below.
// Collection slug to use: 'bankruptcy-sales' (create if needed)
// Fields expected: title, description, price, deadline, contact

async function importBankruptcySales(
  payload: Payload,
  records: ScrapedBankruptcySale[],
): Promise<CollectionStats> {
  // NOTE: If a 'bankruptcy-sales' collection does not exist in Payload config,
  // this section will log errors for each record and skip them gracefully.
  // Add the collection to src/collections/ and re-run to populate it.
  console.log(`\nImporting bankruptcy sales (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  // Dedup by title + deadline
  const seen = new Set<string>()

  for (const [i, rec] of records.entries()) {
    const dedupKey = `${rec.title}||${rec.deadline}`
    if (seen.has(dedupKey)) { skipped++; continue }
    seen.add(dedupKey)

    try {
      // Check for existing record by title match
      const existing = await findByField(payload, 'bankruptcy-sales', 'title', rec.title)
      if (existing) { skipped++; continue }

      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'bankruptcy-sales',
            data: {
              title: rec.title,
              description: rec.description,
              price: rec.price,
              deadline: rec.deadline,
              contact: rec.contact,
            },
          }),
        `bankruptcy-sales[${i}] "${rec.title}"`)
      }
      created++
    } catch (err) {
      // Collection may not exist — log but don't abort other collections
      if (i === 0) {
        console.warn(
          `    ! bankruptcy-sales collection may not exist in Payload config:`,
          (err as Error).message,
        )
        console.warn(`    ! Skipping all bankruptcy-sales records. Add the collection and re-run.`)
        return { collection: 'bankruptcy-sales', created: 0, skipped: records.length, errors: 1 }
      }
      console.error(`    bankruptcy-sales[${i}] "${rec.title}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length}`)
    }
  }
  console.log(`  bankruptcy-sales: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'bankruptcy-sales', created, skipped, errors }
}

// ─── 8. court decisions ───────────────────────────────────────────────────────

async function importDecisions(
  payload: Payload,
  records: ScrapedDecision[],
  courtIdMap: Map<string, string>,
): Promise<CollectionStats> {
  console.log(`\nImporting court decisions (${records.length} records)...`)
  let created = 0, skipped = 0, errors = 0

  for (const [i, rec] of records.entries()) {
    try {
      const existing = await findByField(payload, 'court-decisions', 'caseNumber', rec.caseNumber)
      if (existing) { skipped++; continue }

      const courtId = courtIdMap.get(normKey(rec.courtName))
      if (!courtId) {
        console.warn(`    ! court-decisions: no court for "${rec.courtName}" (${rec.caseNumber})`)
        errors++
        continue
      }

      if (!DRY_RUN) {
        await withRetry(() =>
          (payload as AnyPayload).create({
            collection: 'court-decisions',
            data: {
              title: rec.title,
              court: courtId,
              decisionType: resolveDecisionType(rec.decisionType),
              date: rec.date,
              caseNumber: rec.caseNumber,
              summary: rec.summary,
              category: rec.category,
              fullTextPlain: rec.fullText,
              lang: 'hr',
            },
          }),
        `court-decisions[${i}] "${rec.caseNumber}"`)
      }
      created++
    } catch (err) {
      console.error(`    court-decisions[${i}] "${rec.caseNumber}":`, (err as Error).message)
      errors++
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      console.log(`    … ${i + 1}/${records.length} (created ${created}, skipped ${skipped}, errors ${errors})`)
    }
  }
  console.log(`  court-decisions: created ${created}, skipped ${skipped}, errors ${errors}`)
  return { collection: 'court-decisions', created, skipped, errors }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Run the full import pipeline.
 *
 * @param dataDir  Path to the directory containing scraped JSON files.
 *                 Defaults to `./data` relative to this file.
 */
export async function importAll(dataDir?: string): Promise<void> {
  const resolvedDataDir = dataDir ?? path.join(__dirname, 'data')

  console.log('\n=== Sudačka Mreža — Importer ===')
  if (DRY_RUN) console.log('  DRY RUN — no records will be written\n')
  console.log(`  Data dir : ${resolvedDataDir}\n`)

  const configPath = path.resolve(__dirname, '../payload.config.js')
  const config = await import(configPath)
  const payload = await getPayload({ config: config.default })

  const courts = loadJson<ScrapedCourt>(resolvedDataDir, 'courts.json')
  const stateAttorneys = loadJson<ScrapedStateAttorney>(resolvedDataDir, 'state-attorneys.json')
  const experts = loadJson<ScrapedExpert>(resolvedDataDir, 'experts.json')
  const interpreters = loadJson<ScrapedInterpreter>(resolvedDataDir, 'interpreters.json')
  const decisions = loadJson<ScrapedDecision>(resolvedDataDir, 'decisions.json')
  const bankruptcyAdmins = loadJson<ScrapedBankruptcyAdmin>(resolvedDataDir, 'bankruptcy-admins.json')
  const bankruptcyListings = loadJson<ScrapedBankruptcyListing>(resolvedDataDir, 'bankruptcy-listings.json')
  const bankruptcySales = loadJson<ScrapedBankruptcySale>(resolvedDataDir, 'bankruptcy-sales.json')

  const allStats: CollectionStats[] = []

  // Import in dependency order
  const { idMap: courtIdMap, stats: courtStats } = await importCourts(payload, courts)
  allStats.push(courtStats)

  allStats.push(await importStateAttorneys(payload, stateAttorneys))

  const { idMap: adminIdMap, stats: adminStats } = await importBankruptcyAdmins(payload, bankruptcyAdmins)
  allStats.push(adminStats)

  allStats.push(await importExperts(payload, experts, courtIdMap))
  allStats.push(await importInterpreters(payload, interpreters, courtIdMap))
  allStats.push(await importBankruptcyListings(payload, bankruptcyListings, courtIdMap, adminIdMap))

  if (bankruptcySales.length > 0) {
    allStats.push(await importBankruptcySales(payload, bankruptcySales))
  }

  // Court decisions last — they reference courts and are typically the largest dataset
  allStats.push(await importDecisions(payload, decisions, courtIdMap))

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n=== Import Summary ===')
  let totalCreated = 0, totalSkipped = 0, totalErrors = 0
  for (const s of allStats) {
    console.log(`  ${s.collection.padEnd(30)} created: ${s.created}, skipped: ${s.skipped}, errors: ${s.errors}`)
    totalCreated += s.created
    totalSkipped += s.skipped
    totalErrors += s.errors
  }
  console.log(`  ${'TOTAL'.padEnd(30)} created: ${totalCreated}, skipped: ${totalSkipped}, errors: ${totalErrors}`)
  console.log('\n=== Import complete ===\n')
}

// ─── direct execution ─────────────────────────────────────────────────────────

importAll().then(() => process.exit(0)).catch(err => {
  console.error('Importer failed:', err)
  process.exit(1)
})
