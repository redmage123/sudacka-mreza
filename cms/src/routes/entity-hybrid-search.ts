/**
 * GET /api/entity/hybrid-search?type=<expert-witnesses|interpreters|judges|state-attorneys>&q=...
 *
 * Hybrid keyword + semantic search over an entity table. Keyword pass
 * runs Postgres pg_trgm similarity; semantic pass runs cosine distance
 * over a nomic-embed-text embedding stored on each row. The two ranked
 * lists fuse via Reciprocal Rank Fusion (RRF, k=60).
 *
 * Direct node-postgres queries via payload.db.pool — same pattern as
 * decisions/hybrid-search.
 */
import { Router, type Request, type Response } from 'express'

const OLLAMA = (process.env.LLM_ENDPOINT || 'http://172.18.0.1:11434').replace(/\/+v1\/.*$/, '')
const EMBED_MODEL = 'nomic-embed-text:latest'
const RRF_K = 60
const KEYWORD_POOL = 80
const VECTOR_POOL = 50

interface TableConfig {
  table: string
  keywordCols: string[]
  selectCols: string[]
}

const TABLES: Record<string, TableConfig> = {
  'expert-witnesses': {
    table: 'expert_witnesses',
    keywordCols: ['name', 'company', 'county', 'city'],
    selectCols: ['id', 'name', 'address', 'county', 'city', 'company', 'email', 'phone', 'verified', 'slug'],
  },
  interpreters: {
    table: 'interpreters',
    keywordCols: ['name', 'company', 'county', 'city'],
    selectCols: ['id', 'name', 'address', 'county', 'city', 'company', 'email', 'phone', 'verified', 'slug'],
  },
  judges: {
    table: 'judges',
    keywordCols: ['name', 'first_name', 'last_name', 'specialization', 'department'],
    selectCols: ['id', 'name', 'first_name', 'last_name', 'court_id', 'specialization', 'department', 'status', 'slug'],
  },
  'state-attorneys': {
    table: 'state_attorneys',
    keywordCols: ['name', 'address', 'city', 'county'],
    selectCols: ['id', 'name', 'address', 'city', 'county', 'phone', 'email', 'slug'],
  },
}

async function embed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { embeddings?: number[][]; embedding?: number[] }
    return (j.embeddings && j.embeddings[0]) || j.embedding || null
  } catch {
    return null
  }
}

function vec(v: number[]): string {
  return `[${v.join(',')}]`
}

export function createEntityHybridSearchRouter(payload: any) {
  const router = Router()

  router.get('/entity/hybrid-search', async (req: Request, res: Response) => {
    const type = String(req.query.type || '')
    const q = String(req.query.q || '').trim()
    const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit || '20'), 10)))
    const cfg = TABLES[type]
    if (!cfg) return res.status(400).json({ errors: [{ message: 'unknown type' }] })
    if (!q) return res.status(400).json({ errors: [{ message: 'q required' }] })

    const pool = payload.db.pool as {
      query: (sql: string, params: any[]) => Promise<{ rows: any[] }>
    }

    const keywordExpr = cfg.keywordCols.map((c) => `coalesce(${c},'')`).join(` || ' ' || `)
    const selectExpr = cfg.selectCols.join(', ')

    // Run keyword + semantic in parallel.
    const [keywordRes, vecArr] = await Promise.all([
      pool.query(
        `SELECT ${selectExpr},
                similarity(${keywordExpr}, $1) AS sim
           FROM ${cfg.table}
          WHERE ${keywordExpr} ILIKE $2
          ORDER BY sim DESC
          LIMIT ${KEYWORD_POOL}`,
        [q, '%' + q + '%'],
      ).catch(() => ({ rows: [] })),
      embed(q),
    ])

    let semanticRows: any[] = []
    if (vecArr) {
      try {
        const r = await pool.query(
          `SELECT ${selectExpr},
                  1 - (embedding <=> $1::vector) AS sim
             FROM ${cfg.table}
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT ${VECTOR_POOL}`,
          [vec(vecArr)],
        )
        semanticRows = r.rows
      } catch {
        /* embedding column may not exist for this entity; degrade gracefully */
      }
    }

    // RRF fusion
    const scores = new Map<string, { row: any; score: number }>()
    keywordRes.rows.forEach((row, i) => {
      const id = String(row.id)
      scores.set(id, { row, score: 1 / (RRF_K + i + 1) })
    })
    semanticRows.forEach((row, i) => {
      const id = String(row.id)
      const prev = scores.get(id)
      if (prev) prev.score += 1 / (RRF_K + i + 1)
      else scores.set(id, { row, score: 1 / (RRF_K + i + 1) })
    })

    const docs = [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({ ...row, _score: score }))

    // Enrich judges with court name for nicer rendering.
    if (type === "judges" && docs.length > 0) {
      const courtIds = [...new Set(docs.map((d: any) => d.court_id).filter(Boolean))]
      if (courtIds.length > 0) {
        const cr = await pool.query(
          `SELECT id, name FROM courts WHERE id = ANY($1::int[])`,
          [courtIds as any],
        )
        const byId = new Map(cr.rows.map((r: any) => [r.id, r.name]))
        for (const d of docs as any[]) {
          if (d.court_id != null) d.court = { id: d.court_id, name: byId.get(d.court_id) ?? null }
        }
      }
    }

    return res.json({ docs, totalDocs: docs.length })
  })

  return router
}
