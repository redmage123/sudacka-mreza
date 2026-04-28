/**
 * GET /api/eurlex-search
 *
 * Semantic search over the indexed EUR-Lex corpus stored in pgvector.
 *
 * Query params:
 *   q       — natural-language query (any language; embedded as-is)
 *   lang    — restrict to documents in this language (default: any)
 *   scope   — caselaw | legislation | any (default: any)
 *   limit   — top-K results (default 10, max 50)
 *
 * Response:
 *   { docs: [{celex, lang, date, title, snippet, score, url}], total }
 *
 * The embedding model is the same nomic-embed-text the chat pipeline uses
 * (768-d). The eurlex_docs table is auto-created on first read.
 */
import { Router, type Request, type Response } from 'express'
import type { Payload } from 'payload'

const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://172.18.0.1:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''

interface PgPool {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>
}

function poolFromPayload(payload: Payload): PgPool {
  return (payload.db as unknown as { pool: PgPool }).pool
}

let schemaReady = false
async function ensureSchema(pool: PgPool): Promise<void> {
  if (schemaReady) return
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eurlex_docs (
      id          SERIAL PRIMARY KEY,
      celex       TEXT NOT NULL,
      lang        TEXT NOT NULL,
      scope       TEXT NOT NULL,
      date        DATE,
      title       TEXT,
      chunk_idx   INT  NOT NULL DEFAULT 0,
      chunk_text  TEXT NOT NULL,
      embedding   vector(768),
      UNIQUE (celex, lang, chunk_idx)
    );
    CREATE INDEX IF NOT EXISTS eurlex_docs_celex_idx ON eurlex_docs(celex);
    CREATE INDEX IF NOT EXISTS eurlex_docs_scope_idx ON eurlex_docs(scope);
    CREATE INDEX IF NOT EXISTS eurlex_docs_lang_idx  ON eurlex_docs(lang);
  `)
  // ivfflat needs to be created once we have a few thousand rows; defer to
  // an explicit "vacuum + create index" in the indexer.
  schemaReady = true
}

async function embedQuery(text: string): Promise<number[] | null> {
  const url = `${OLLAMA_BASE}/api/embed`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LLM_API_TOKEN) headers['Authorization'] = 'Bearer ' + LLM_API_TOKEN
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) return null
  const j = (await r.json()) as { embeddings?: number[][] }
  return j.embeddings?.[0] ?? null
}

function pgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

const buckets = new Map<string, { tokens: number; last: number }>()
const RATE_CAPACITY = 30
const RATE_REFILL_PER_MIN = 30
function takeToken(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip) ?? { tokens: RATE_CAPACITY, last: now }
  const elapsedMin = (now - b.last) / 60_000
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + elapsedMin * RATE_REFILL_PER_MIN)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}

export function createEurLexSearchRouter(payload: Payload): Router {
  const router = Router()

  router.get('/eurlex-search', async (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || 'unknown'
    if (!takeToken(ip)) {
      return res.status(429).json({ errors: [{ message: 'Rate limit — try again in a moment.' }] })
    }
    const q = String(req.query.q ?? '').trim()
    if (!q) return res.status(400).json({ errors: [{ message: 'q required' }] })
    if (q.length > 500) return res.status(400).json({ errors: [{ message: 'q too long' }] })
    const lang = String(req.query.lang ?? '').toLowerCase().trim()
    const scopeRaw = String(req.query.scope ?? 'any').toLowerCase()
    const scope = ['caselaw', 'legislation', 'any'].includes(scopeRaw) ? scopeRaw : 'any'
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10) || 10))

    const pool = poolFromPayload(payload)
    try {
      await ensureSchema(pool)
    } catch (e) {
      payload.logger.warn({ err: String(e) }, 'eurlex-search schema check failed')
    }

    let vec: number[] | null = null
    try {
      vec = await embedQuery(q)
    } catch (e) {
      payload.logger.warn({ err: String(e) }, 'eurlex-search embed failed')
    }
    if (!vec) {
      return res.status(503).json({ errors: [{ message: 'Embedder unavailable.' }] })
    }

    const params: unknown[] = [pgVectorLiteral(vec), limit]
    const where: string[] = []
    if (lang && /^[a-z]{2}$/.test(lang)) {
      params.push(lang)
      where.push(`lang = $${params.length}`)
    }
    if (scope !== 'any') {
      params.push(scope)
      where.push(`scope = $${params.length}`)
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    // Cosine distance in pgvector: smaller = better. Convert to a "score"
    // in [0,1] for the UI (1 = perfect match) using 1 - distance.
    const sql = `
      SELECT celex, lang, scope, date, title, chunk_idx,
             LEFT(chunk_text, 600) AS snippet,
             1 - (embedding <=> $1::vector) AS score
      FROM eurlex_docs
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `
    let rows: Array<{
      celex: string
      lang: string
      scope: string
      date: string | null
      title: string | null
      chunk_idx: number
      snippet: string
      score: number
    }> = []
    try {
      const r = await pool.query(sql, params)
      rows = r.rows as typeof rows
    } catch (e) {
      payload.logger.error({ err: String(e) }, 'eurlex-search query failed')
      return res.status(500).json({ errors: [{ message: 'Search failed.' }] })
    }

    const docs = rows.map((r) => ({
      celex: r.celex,
      lang: r.lang,
      scope: r.scope,
      date: r.date,
      title: r.title,
      snippet: r.snippet,
      score: Number(r.score),
      chunkIdx: r.chunk_idx,
      url: `https://eur-lex.europa.eu/legal-content/${r.lang.toUpperCase()}/TXT/?uri=CELEX:${r.celex}`,
    }))
    res.json({ docs, total: docs.length, query: q, scope, lang: lang || null })
  })

  return router
}
