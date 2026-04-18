/**
 * ingestToRag — afterChange hook for CourtDecisions.
 *
 * After a court decision is saved (create or update), send it to the RAG API
 * at http://localhost:8020 so it gets vector-embedded and becomes available
 * for semantic search via the hybrid search endpoint.
 *
 * This hook is fire-and-forget: failures are logged but never propagate to
 * the caller so that a RAG outage never breaks the admin save operation.
 */
import type { CollectionAfterChangeHook } from 'payload'
import { lexicalToText } from '../utils/lexicalToText.js'

const RAG_URL = process.env.RAG_URL || 'http://localhost:8020'
const RAG_API_KEY = process.env.RAG_API_KEY || 'rag_ak_aielevate_2026_secret'

export const ingestToRag: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    // Build the document content for embedding.
    // Prefix the ID so the hybrid search endpoint can map RAG results back to
    // decision IDs without a separate lookup.  Format: [<id>] <title>
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
        .map((t: unknown) => (typeof t === 'string' ? t : (t as Record<string, string>)?.tag))
        .filter(Boolean)
        .join(', ')
      if (tagList) lines.push(`Oznake: ${tagList}`)
    }

    // Use the Lexical rich-text directly rather than relying on fullTextPlain
    // being written by generateSearchIndex (which runs in the same afterChange
    // batch and may not yet be committed when this hook fires).
    const fullText = lexicalToText(doc.fullText)
    if (fullText) lines.push('', fullText)

    const content = lines.join('\n')

    await fetch(`${RAG_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAG_API_KEY}`,
      },
      body: JSON.stringify({
        org_slug: 'gigforge',
        collection_slug: 'sudacka-caselaw',
        documents: [
          {
            // Title format: "[<id>] <decision title>" — parsed by hybrid-search.ts
            title: `[${doc.id}] ${doc.title ?? 'Odluka'}`,
            content,
            source_type: 'markdown',
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    }).then((res) => {
      if (!res.ok) {
        req.payload.logger.warn(`RAG ingest HTTP ${res.status} for decision ${doc.id}`)
      }
    })
  } catch (err) {
    // Never let a RAG failure block the CMS save operation.
    req.payload.logger.warn(
      `RAG ingest failed for decision ${doc.id}: ${(err as Error).message}`,
    )
  }

  return doc
}
