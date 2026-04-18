/**
 * espisSync — Cron job stub for polling eSPIS and importing new decisions
 *             into the Payload CMS `court-decisions` collection.
 *
 * STATUS: MOCK MODE
 *   The job runs on its normal schedule and logs every action it *would* take,
 *   but makes no writes to the database until ESPIS_SYNC_ENABLED=true is set.
 *
 * Schedule: every 6 hours (adjust via cron expression or Payload task config).
 *
 * To enable live sync once API access is granted:
 *   1. Set ESPIS_API_URL and ESPIS_API_KEY in .env
 *   2. Swap MockEspisClient for RealEspisClient in integrations/espis.ts
 *   3. Set ESPIS_SYNC_ENABLED=true in .env
 */

import { espisClient, type Decision } from '../integrations/espis.js'

/** Croatian courts to poll, keyed by their eSPIS canonical name. */
const COURTS_TO_SYNC: string[] = [
  'Vrhovni sud Republike Hrvatske',
  'Ustavni sud Republike Hrvatske',
  'Visoki upravni sud Republike Hrvatske',
  'Visoki trgovački sud Republike Hrvatske',
  'Visoki kazneni sud Republike Hrvatske',
  'Županijski sud u Zagrebu',
  'Županijski sud u Splitu',
  'Županijski sud u Rijeci',
  'Županijski sud u Osijeku',
]

const ENABLED = process.env.ESPIS_SYNC_ENABLED === 'true'
const SYNC_WINDOW_HOURS = Number(process.env.ESPIS_SYNC_WINDOW_HOURS ?? '24')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sinceDate(): Date {
  return new Date(Date.now() - SYNC_WINDOW_HOURS * 60 * 60 * 1000)
}

/**
 * Map an eSPIS Decision to a Payload `court-decisions` create payload.
 * Field names must match CourtDecisions.ts collection schema.
 *
 * NOTE: `court` here is a plain string from eSPIS; you will need to resolve it
 * to a Payload court document ID before passing to payload.create().
 */
function decisionToPayload(decision: Decision): Record<string, unknown> {
  return {
    title:        decision.title,
    caseNumber:   decision.caseNumber,
    decisionType: decision.decisionType,
    date:         decision.date.toISOString(),
    fullTextPlain: decision.fullText,
    summary:      decision.summary ?? '',
    lang:         decision.languages[0] ?? 'hr',
    // court:     <resolved Payload court ID>  — set after court lookup
  }
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

async function syncCourt(payload: any, court: string, since: Date): Promise<void> {
  let decisions: Decision[]
  try {
    decisions = await espisClient.fetchNewDecisions(court, since)
  } catch (err) {
    console.error(`[espisSync] Failed to fetch from eSPIS for court "${court}":`, err)
    return
  }

  if (decisions.length === 0) {
    console.log(`[espisSync] No new decisions for "${court}" since ${since.toISOString()}`)
    return
  }

  console.log(`[espisSync] ${decisions.length} new decision(s) for "${court}"`)

  for (const decision of decisions) {
    const docPayload = decisionToPayload(decision)

    if (!ENABLED) {
      // Mock mode — log what would happen, write nothing
      console.log(
        `[espisSync] MOCK — would import: ${decision.caseNumber} — "${decision.title}"`,
        JSON.stringify(docPayload, null, 2),
      )
      continue
    }

    // Live mode — resolve court ID then create the document
    try {
      const courtResult = await payload.find({
        collection: 'courts',
        where: { name_hr: { equals: court } },
        limit: 1,
      })

      const courtId: string | undefined = courtResult.docs[0]?.id
      if (!courtId) {
        console.warn(`[espisSync] Court not found in Payload: "${court}" — skipping`)
        continue
      }

      // Check for existing document (avoid duplicates on reruns)
      const existing = await payload.find({
        collection: 'court-decisions',
        where: { caseNumber: { equals: decision.caseNumber } },
        limit: 1,
      })

      if (existing.totalDocs > 0) {
        console.log(`[espisSync] Already imported: ${decision.caseNumber} — skipping`)
        continue
      }

      await payload.create({
        collection: 'court-decisions',
        data: { ...docPayload, court: courtId },
      })

      console.log(`[espisSync] Imported: ${decision.caseNumber} — "${decision.title}"`)
    } catch (err) {
      console.error(`[espisSync] Failed to import ${decision.caseNumber}:`, err)
    }
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * runEspisSync — call this from your Payload task scheduler or a cron runner.
 *
 * Example usage in server.ts (after Payload is initialised):
 *
 *   import { runEspisSync } from './jobs/espisSync.js'
 *   setInterval(() => runEspisSync(payload), 6 * 60 * 60 * 1000)   // every 6h
 *   runEspisSync(payload)   // run once on startup
 */
export async function runEspisSync(payload: any): Promise<void> {
  const since = sinceDate()

  console.log(
    `[espisSync] Starting sync (mode=${ENABLED ? 'LIVE' : 'MOCK'}, window=${SYNC_WINDOW_HOURS}h, since=${since.toISOString()})`,
  )

  for (const court of COURTS_TO_SYNC) {
    await syncCourt(payload, court, since)
  }

  console.log('[espisSync] Sync complete')
}
