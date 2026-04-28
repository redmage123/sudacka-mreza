/**
 * GET /api/decisions/hybrid-search
 *
 * Hybrid search that merges PostgreSQL full-text search (tsvector + ts_rank)
 * with RAG semantic search (pgvector cosine similarity via the local RAG API).
 *
 * Supports natural-language queries such as:
 *   "slučajevi o imovinskim sporovima u Zagrebu"
 *   "presude suca Novaka o radnom pravu"
 *
 * Algorithm: Reciprocal Rank Fusion (RRF) with k=60.
 *   hybrid_score = Σ 1/(k + rank_in_list_i)
 * This combines the two ranked lists without requiring score normalisation.
 *
 * When q is empty the endpoint falls back to a plain date-sorted listing.
 *
 * Query params — identical to /api/decisions/search:
 *   q            free-text / natural-language query
 *   page         1-based page number (default 1)
 *   limit        results per page, max 50 (default 20)
 *   court        court UUID
 *   courtType    municipal | county | commercial | misdemeanour | supreme | constitutional
 *   decisionType civil | criminal | commercial | administrative | constitutional | ecj | ecthr
 *   category     free-text category filter
 *   from         ISO date lower bound
 *   to           ISO date upper bound
 */

import { Router, type Request, type Response } from 'express'

import { translateBatch } from '../utils/translateLegal.js'

const RAG_URL = process.env.RAG_URL || 'http://localhost:8020'
const RAG_API_KEY = process.env.RAG_API_KEY || 'rag_ak_aielevate_2026_secret'

/** Reciprocal rank fusion smoothing constant */
const RRF_K = 60
/** Max FTS candidates to consider for re-ranking */
const FTS_POOL_SIZE = 200
/** Max semantic candidates to request from RAG */
const RAG_TOP_K = 30

interface RagResult {
  document_title: string
  content?: string
  score?: number
}

/** Parse decision ID from RAG document title formatted as "[<id>] <title>". */
function parseRagId(title: string | undefined | null): string | null {
  if (!title) return null
  const m = title.match(/^\[(\w+)\]/)
  return m ? m[1] : null
}

async function queryRag(query: string): Promise<RagResult[]> {
  const res = await fetch(`${RAG_URL}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RAG_API_KEY}`,
    },
    body: JSON.stringify({
      org_slug: 'gigforge',
      collection_slug: 'sudacka-caselaw',
      query,
      top_k: RAG_TOP_K,
      hybrid: true,
      rerank: true,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`RAG API returned HTTP ${res.status}`)
  const data = (await res.json()) as { results?: RagResult[] }
  return Array.isArray(data.results) ? data.results : []
}

export function createHybridSearchRouter(payload: any) {
  const router = Router()

  router.get('/decisions/hybrid-search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim()
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)))
    const offset = (page - 1) * limit

    const courtId = req.query.court ? String(req.query.court) : null
    const courtType = req.query.courtType ? String(req.query.courtType) : null
    const decisionType = req.query.decisionType ? String(req.query.decisionType) : null
    const category = req.query.category ? String(req.query.category) : null
    const from = req.query.from ? String(req.query.from) : null
    const to = req.query.to ? String(req.query.to) : null

    try {
      const pool = payload.db.pool as {
        query: (sql: string, params: (string | number | string[])[]) => Promise<{ rows: any[] }>
      }

      // -----------------------------------------------------------------------
      // No query — return date-sorted listing (same behaviour as before)
      // -----------------------------------------------------------------------
      if (!q) {
        const filterConditions: string[] = []
        const filterParams: (string | number)[] = []
        let pIdx = 1

        if (courtId) { filterConditions.push(`cd.court_id = $${pIdx++}`); filterParams.push(courtId) }
        if (decisionType) { filterConditions.push(`cd.decision_type = $${pIdx++}`); filterParams.push(decisionType) }
        if (category) { filterConditions.push(`cd.category = $${pIdx++}`); filterParams.push(category) }
        if (from) { filterConditions.push(`cd.date >= $${pIdx++}`); filterParams.push(from) }
        if (to) { filterConditions.push(`cd.date <= $${pIdx++}`); filterParams.push(to) }
        if (courtType) { filterConditions.push(`c.type = $${pIdx++}`); filterParams.push(courtType) }

        const whereClause = filterConditions.length
          ? `WHERE ${filterConditions.join(' AND ')}`
          : ''

        const countRes = await pool.query(
          `SELECT COUNT(*) AS total FROM court_decisions cd LEFT JOIN courts c ON cd.court_id = c.id ${whereClause}`,
          filterParams,
        )
        const totalDocs = parseInt(countRes.rows[0]?.total ?? '0', 10)
        const totalPages = Math.ceil(totalDocs / limit)

        const dataRes = await pool.query(
          `SELECT cd.id, cd.title, cd.case_number, cd.date, cd.decision_type, cd.category, cd.slug,
                  c.id AS court_id, c.name AS court_name
           FROM court_decisions cd
           LEFT JOIN courts c ON cd.court_id = c.id
           ${whereClause}
           ORDER BY cd.date DESC
           LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
          [...filterParams, limit, offset],
        )

        return res.json({
          docs: dataRes.rows.map((r) => formatDoc(r, null, 0)),
          totalDocs,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null,
          searchMode: 'browse',
        })
      }

      // -----------------------------------------------------------------------
      // Build shared filter conditions (used by both FTS count and pool queries)
      // -----------------------------------------------------------------------
      const filterParams: (string | number)[] = [q] // $1 = query
      const filterConditions: string[] = [
        `to_tsvector('simple',
           coalesce(cd.full_text_plain, '') || ' ' ||
           coalesce(cd.search_vector, '') || ' ' ||
           coalesce(cd.title, '') || ' ' ||
           coalesce(cd.case_number, '')
         ) @@ plainto_tsquery('simple', $1)`,
      ]
      let pIdx = 2

      if (courtId) { filterConditions.push(`cd.court_id = $${pIdx++}`); filterParams.push(courtId) }
      if (decisionType) { filterConditions.push(`cd.decision_type = $${pIdx++}`); filterParams.push(decisionType) }
      if (category) { filterConditions.push(`cd.category = $${pIdx++}`); filterParams.push(category) }
      if (from) { filterConditions.push(`cd.date >= $${pIdx++}`); filterParams.push(from) }
      if (to) { filterConditions.push(`cd.date <= $${pIdx++}`); filterParams.push(to) }
      if (courtType) { filterConditions.push(`c.type = $${pIdx++}`); filterParams.push(courtType) }

      const where = filterConditions.join(' AND ')

      // -----------------------------------------------------------------------
      // Run FTS pool query + RAG semantic query in parallel
      // -----------------------------------------------------------------------
      const [ftsPoolResult, ragResults] = await Promise.allSettled([
        pool.query(
          `SELECT
             cd.id,
             cd.title,
             cd.case_number,
             cd.date,
             cd.decision_type,
             cd.category,
             cd.slug,
             c.id   AS court_id,
             c.name AS court_name,
             ts_rank(
               to_tsvector('simple',
                 coalesce(cd.full_text_plain, '') || ' ' ||
                 coalesce(cd.search_vector, '') || ' ' ||
                 coalesce(cd.title, '') || ' ' ||
                 coalesce(cd.case_number, '')
               ),
               plainto_tsquery('simple', $1)
             ) AS fts_rank,
             ts_headline(
               'simple',
               coalesce(cd.full_text_plain, cd.search_vector, cd.title, ''),
               plainto_tsquery('simple', $1),
               'MaxFragments=1, MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>'
             ) AS excerpt
           FROM court_decisions cd
           LEFT JOIN courts c ON cd.court_id = c.id
           WHERE ${where}
           ORDER BY fts_rank DESC
           LIMIT ${FTS_POOL_SIZE}`,
          filterParams,
        ),
        queryRag(q),
      ])

      const ftsRows: any[] =
        ftsPoolResult.status === 'fulfilled' ? ftsPoolResult.value.rows : []
      const ragList: RagResult[] =
        ragResults.status === 'fulfilled' ? ragResults.value : []

      if (ftsPoolResult.status === 'rejected') {
        payload.logger.error('FTS query failed in hybrid-search:', ftsPoolResult.reason)
      }
      if (ragResults.status === 'rejected') {
        // RAG failure is non-fatal — continue with FTS-only results
        payload.logger.warn('RAG query failed in hybrid-search:', ragResults.reason)
      }

      // -----------------------------------------------------------------------
      // Build ranked maps
      // -----------------------------------------------------------------------
      // ftsMap: id -> { row data, position in FTS list }
      const ftsMap = new Map<string, { row: any; pos: number }>()
      ftsRows.forEach((row, i) => ftsMap.set(String(row.id), { row, pos: i }))

      // ragMap: id -> position in RAG list (IDs parsed from "[id] title" format)
      const ragMap = new Map<string, number>()
      ragList.forEach((result, i) => {
        const id = parseRagId(result.document_title)
        if (id) ragMap.set(id, i)
      })

      // -----------------------------------------------------------------------
      // RRF merge
      // -----------------------------------------------------------------------
      const rrfScores = new Map<string, number>()

      for (const [id, { pos }] of ftsMap) {
        rrfScores.set(id, (rrfScores.get(id) ?? 0) + 1 / (RRF_K + pos + 1))
      }
      for (const [id, pos] of ragMap) {
        rrfScores.set(id, (rrfScores.get(id) ?? 0) + 1 / (RRF_K + pos + 1))
      }

      const ranked = [...rrfScores.entries()]
        .sort((a, b) => b[1] - a[1])

      // Total count: use SQL count for accurate pagination (FTS is the authoritative
      // count; RAG results within the FTS pool are already included)
      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM court_decisions cd LEFT JOIN courts c ON cd.court_id = c.id WHERE ${where}`,
        filterParams,
      )
      const ftsTotalDocs = parseInt(countResult.rows[0]?.total ?? '0', 10)
      // Add any RAG-exclusive results not already in FTS count
      const ragOnlyCount = [...ragMap.keys()].filter((id) => !ftsMap.has(id)).length
      const totalDocs = ftsTotalDocs + ragOnlyCount
      const totalPages = Math.ceil(totalDocs / limit)

      // Paginated slice of the merged ranking
      const pageSlice = ranked.slice(offset, offset + limit)

      // IDs from RAG that aren't in the FTS pool need a DB fetch for metadata
      const ragOnlyIds = pageSlice
        .map(([id]) => id)
        .filter((id) => !ftsMap.has(id))

      let ragOnlyMap = new Map<string, any>()
      if (ragOnlyIds.length > 0) {
        // Fetch metadata + verify filters are satisfied for RAG-exclusive results
        const ragFilterConditions: string[] = [`cd.id = ANY($1)`]
        const ragFilterParams: (string | number | string[])[] = [ragOnlyIds]
        let rIdx = 2

        // Re-apply structural filters so RAG results that don't match are excluded
        if (courtId) { ragFilterConditions.push(`cd.court_id = $${rIdx++}`); ragFilterParams.push(courtId) }
        if (decisionType) { ragFilterConditions.push(`cd.decision_type = $${rIdx++}`); ragFilterParams.push(decisionType) }
        if (category) { ragFilterConditions.push(`cd.category = $${rIdx++}`); ragFilterParams.push(category) }
        if (from) { ragFilterConditions.push(`cd.date >= $${rIdx++}`); ragFilterParams.push(from) }
        if (to) { ragFilterConditions.push(`cd.date <= $${rIdx++}`); ragFilterParams.push(to) }
        if (courtType) { ragFilterConditions.push(`c.type = $${rIdx++}`); ragFilterParams.push(courtType) }

        const ragOnlyResult = await pool.query(
          `SELECT cd.id, cd.title, cd.case_number, cd.date, cd.decision_type, cd.category, cd.slug,
                  c.id AS court_id, c.name AS court_name
           FROM court_decisions cd
           LEFT JOIN courts c ON cd.court_id = c.id
           WHERE ${ragFilterConditions.join(' AND ')}`,
          ragFilterParams,
        )
        ragOnlyMap = new Map(ragOnlyResult.rows.map((r) => [String(r.id), r]))
      }

      // -----------------------------------------------------------------------
      // Build final response in RRF order
      // -----------------------------------------------------------------------
      const docs = pageSlice
        .map(([id, score]) => {
          const ftsEntry = ftsMap.get(id)
          const row = ftsEntry?.row ?? ragOnlyMap.get(id)
          if (!row) return null

          const inRag = ragMap.has(id)
          const inFts = ftsMap.has(id)
          const mode: string = inRag && inFts ? 'hybrid' : inRag ? 'semantic' : 'keyword'

          return formatDoc(row, ftsEntry?.row?.excerpt ?? null, score, mode)
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)

      // Optional on-demand translation of title + excerpt for non-Croatian
      // UI languages. We translate the page slice only (not the full result
      // set) so latency scales with `limit`, not the corpus.
      const lang = String(req.query.lang || '').toLowerCase().trim()
      if (lang && lang !== 'hr' && /^[a-z]{2}$/.test(lang)) {
        try {
          const fields = docs.flatMap((d) => {
            const out: Array<{ entityType: 'decision'; entityId: string; field: 'title' | 'excerpt'; text: string }> = []
            if (d.title) out.push({ entityType: 'decision', entityId: d.id, field: 'title', text: d.title })
            if (d.excerpt) out.push({ entityType: 'decision', entityId: d.id, field: 'excerpt', text: d.excerpt })
            return out
          })
          const translations = await translateBatch(payload, lang, fields)
          for (const d of docs) {
            const tT = translations.get(`decision:${d.id}:title`)
            const tE = translations.get(`decision:${d.id}:excerpt`)
            if (tT && tT !== d.title) {
              ;(d as Record<string, unknown>).titleOriginal = d.title
              d.title = tT
            }
            if (tE && tE !== d.excerpt) {
              ;(d as Record<string, unknown>).excerptOriginal = d.excerpt
              d.excerpt = tE
            }
            ;(d as Record<string, unknown>).translatedLang = lang
          }
        } catch (err) {
          payload.logger.warn({ err: String(err), lang }, 'hybrid-search translation pass failed')
        }
      }

      return res.json({
        docs,
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        searchMode: ragList.length > 0 ? 'hybrid' : 'keyword',
      })
    } catch (err) {
      payload.logger.error('hybrid-search error:', err)
      return res.status(500).json({ error: 'Interna pogreška servera' })
    }
  })

  return router
}

function formatDoc(
  row: any,
  excerpt: string | null,
  rank: number,
  searchMode?: string,
) {
  return {
    id: String(row.id),
    title: row.title,
    caseNumber: row.case_number,
    date: row.date,
    decisionType: row.decision_type,
    // Also expose as decision_type for schema compatibility
    decision_type: row.decision_type,
    category: row.category,
    slug: row.slug,
    court: row.court_id ? { id: String(row.court_id), name: row.court_name } : null,
    excerpt: excerpt ?? null,
    rank,
    searchMode: searchMode ?? 'keyword',
  }
}
