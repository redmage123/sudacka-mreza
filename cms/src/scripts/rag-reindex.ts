/**
 * rag-reindex.ts — Bulk re-ingest all court decisions into the RAG system.
 *
 * Creates the `sudacka-caselaw` collection (org: gigforge) if it does not
 * exist yet, then pages through every court decision in the Payload database
 * and sends them to the RAG API for vector embedding.
 *
 * This script is idempotent: re-running it will overwrite existing embeddings
 * with fresh ones (the RAG API upserts by document title).
 *
 * Usage:
 *   npm run rag:reindex
 *
 * Env vars:
 *   RAG_URL      RAG API base URL  (default: http://localhost:8020)
 *   RAG_API_KEY  Bearer token      (default: rag_ak_aielevate_2026_secret)
 *   RAG_BATCH    Documents per batch HTTP call (default: 20)
 *   DATABASE_URI PostgreSQL connection string (required)
 *
 * Exit codes:
 *   0 — all decisions ingested successfully (or 0 decisions found)
 *   1 — fatal error (DB connection, RAG API consistently unavailable, etc.)
 */

import { getPayload } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const RAG_URL = process.env.RAG_URL || 'http://localhost:8020'
const RAG_API_KEY = process.env.RAG_API_KEY || 'rag_ak_aielevate_2026_secret'
const BATCH_SIZE = parseInt(process.env.RAG_BATCH ?? '20', 10)

const ORG_SLUG = 'gigforge'
const COLLECTION_SLUG = 'sudacka-caselaw'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Strip Lexical rich-text JSON down to plain text (same logic as lexicalToText util). */
function extractText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (typeof node.text === 'string') return node.text
    const children = Array.isArray(node.children) ? node.children : []
    return children.map(extractText).join(' ')
  }
  return ''
}

/** Build a RAG-ingestable document from a Payload court decision record. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRagDocument(doc: any): { title: string; content: string; source_type: string } {
  const lines: string[] = [
    `DECISION_ID: ${doc.id}`,
    `Naslov: ${doc.title ?? ''}`,
    `Broj predmeta: ${doc.caseNumber ?? ''}`,
    `Vrsta odluke: ${doc.decisionType ?? ''}`,
    `Datum: ${doc.date ?? ''}`,
  ]
  if (doc.summary) lines.push(`Sažetak: ${doc.summary}`)
  if (doc.category) lines.push(`Kategorija: ${doc.category}`)
  if (Array.isArray(doc.tags)) {
    const tagList = doc.tags
      .map((t: unknown) =>
        typeof t === 'string' ? t : (t as Record<string, string>)?.tag,
      )
      .filter(Boolean)
      .join(', ')
    if (tagList) lines.push(`Oznake: ${tagList}`)
  }

  // Prefer fullTextPlain (already extracted by generateSearchIndex hook);
  // fall back to extracting from Lexical JSON.
  const plain =
    typeof doc.fullTextPlain === 'string' && doc.fullTextPlain.trim()
      ? doc.fullTextPlain.trim()
      : extractText(doc.fullText).trim()

  if (plain) lines.push('', plain)

  return {
    title: `[${doc.id}] ${doc.title ?? 'Odluka'}`,
    content: lines.join('\n'),
    source_type: 'markdown',
  }
}

/** Send one batch of documents to the RAG ingest endpoint. */
async function ingestBatch(
  documents: { title: string; content: string; source_type: string }[],
  attempt = 1,
): Promise<void> {
  const res = await fetch(`${RAG_URL}/api/v1/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RAG_API_KEY}`,
    },
    body: JSON.stringify({ org_slug: ORG_SLUG, collection_slug: COLLECTION_SLUG, documents }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (attempt < 3) {
      console.warn(`  RAG ingest HTTP ${res.status} — retry ${attempt}/3`)
      await new Promise<void>((r) => setTimeout(r, 2000 * attempt))
      return ingestBatch(documents, attempt + 1)
    }
    throw new Error(`RAG ingest failed after 3 attempts: HTTP ${res.status} — ${body}`)
  }
}

// ─── bootstrap: verify RAG reachability ──────────────────────────────────────

async function verifyRagReachability(): Promise<void> {
  console.log(`\nChecking RAG API at ${RAG_URL} …`)
  // Trigger collection creation by ingesting a zero-content sentinel document.
  // If the collection already exists this is a cheap no-op upsert.
  await ingestBatch([
    {
      title: '[bootstrap] sudacka-caselaw collection init',
      content: 'Collection initialised by rag-reindex.ts bootstrap step.',
      source_type: 'markdown',
    },
  ])
  console.log(`  ✓ RAG API reachable — collection "${COLLECTION_SLUG}" ensured`)
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== Sudačka Mreža — RAG Re-index ===')
  console.log(`  RAG URL     : ${RAG_URL}`)
  console.log(`  Collection  : ${ORG_SLUG}/${COLLECTION_SLUG}`)
  console.log(`  Batch size  : ${BATCH_SIZE}`)

  // 1. Verify RAG is up and bootstrap the collection.
  await verifyRagReachability()

  // 2. Connect to Payload.
  const configPath = path.resolve(__dirname, '../payload.config.js')
  const configModule = await import(configPath)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = await getPayload({ config: (configModule as any).default })

  // 3. Page through all court decisions and ingest in batches.
  let page = 1
  let totalIngested = 0
  let totalErrors = 0

  console.log('\nPaging through court decisions …')

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload as any).find({
      collection: 'court-decisions',
      page,
      limit: BATCH_SIZE,
      depth: 0,
    })

    const docs: unknown[] = result.docs
    if (docs.length === 0) break

    const ragDocs = docs.map(buildRagDocument)

    try {
      await ingestBatch(ragDocs)
      totalIngested += docs.length
      console.log(
        `  page ${page}: ingested ${docs.length} decisions` +
          ` (total: ${totalIngested}/${result.totalDocs})`,
      )
    } catch (err) {
      console.error(`  page ${page}: ingest failed — ${(err as Error).message}`)
      totalErrors += docs.length
    }

    if (!result.hasNextPage) break
    page++
  }

  // 4. Summary.
  console.log('\n=== Re-index complete ===')
  console.log(`  Ingested : ${totalIngested}`)
  console.log(`  Errors   : ${totalErrors}`)

  if (totalErrors > 0) {
    console.error('\n  Some decisions failed to ingest — check RAG API logs.')
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
