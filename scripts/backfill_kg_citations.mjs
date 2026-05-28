#!/usr/bin/env node
/**
 * One-shot KG backfill: parse Croatian court citation patterns from every
 * court_decisions.full_text_plain row and populate the cited_decisions
 * relation (plus its reverse, cited_by) via the Payload local API.
 *
 * The afterChange citationLinker hook handles writes for *new* docs; this
 * walks the existing 12,832-row corpus that pre-dated the hook.
 *
 * Run via the cms container so the Payload bootstrap, DB pool, and hook
 * suppression context all match the live runtime:
 *   docker compose exec -T cms node /app/scripts/backfill_kg_citations.mjs
 */
import { getPayload } from 'payload'
import config from '/app/dist/payload.config.js'

const CITATION_RX = /(Rev|Gž|Kž|Pž|Us-I|U-III)-\d+\/\d{4}/g

function extractCitations(text) {
  if (!text) return []
  const found = new Set()
  for (const m of text.matchAll(CITATION_RX)) found.add(m[0])
  return [...found]
}

async function main() {
  const payload = await getPayload({ config })
  console.log(`[backfill] payload booted, scanning decisions…`)

  // Walk all decisions in pages; skip those whose case_number itself
  // matches the citation (self-citation is useless edge).
  const pageSize = 200
  let page = 1
  let scanned = 0
  let withCitations = 0
  let totalEdges = 0
  // citing → set(cited slug strings)
  const slugToId = new Map()
  // First pass: build a slug-prefix → id index so we can resolve citation strings to decision IDs.
  // We treat the part of `case_number` matching the citation prefix as the lookup key.
  const idxRes = await payload.db.pool.query(
    `SELECT id::int AS id, case_number FROM court_decisions WHERE case_number IS NOT NULL`,
  )
  for (const r of idxRes.rows) {
    const cn = String(r.case_number)
    const m = cn.match(/(Rev|Gž|Kž|Pž|Us-I|U-III)-\d+\/\d{4}/)
    if (m) slugToId.set(m[0], r.id)
  }
  console.log(`[backfill] indexed ${slugToId.size} decisions by citation key`)

  while (true) {
    const { docs } = await payload.find({
      collection: 'court-decisions',
      limit: pageSize,
      page,
      where: { fullTextPlain: { exists: true } },
      depth: 0,
    })
    if (docs.length === 0) break
    for (const d of docs) {
      scanned++
      const cites = extractCitations(d.fullTextPlain).filter((c) => slugToId.has(c) && slugToId.get(c) !== d.id)
      if (cites.length === 0) continue
      withCitations++
      const targetIds = [...new Set(cites.map((c) => slugToId.get(c)))]
      // Update via local API so the existing afterChange citationLinker fires
      // and writes the reverse cited_by edges idempotently.
      try {
        await payload.update({
          collection: 'court-decisions',
          id: d.id,
          data: { cited_decisions: targetIds },
          depth: 0,
          // Don't trigger search-index/RAG ingest; we only want citation edges.
          context: { skipCitationLinker: false, skipSearchIndex: true, skipRagIngest: true },
        })
        totalEdges += targetIds.length
      } catch (e) {
        console.warn(`[backfill] update id=${d.id} failed: ${e.message}`)
      }
    }
    console.log(`[backfill] page ${page} done (scanned ${scanned}, cited ${withCitations}, edges ${totalEdges})`)
    page++
  }
  console.log(`[backfill] DONE scanned=${scanned} with_citations=${withCitations} total_edges=${totalEdges}`)
  process.exit(0)
}

main().catch((e) => {
  console.error('[backfill] fatal', e)
  process.exit(1)
})
