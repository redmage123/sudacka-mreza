/**
 * GET /api/decisions/search
 *
 * Full-text search over CourtDecisions using PostgreSQL tsvector + ts_rank + ts_headline.
 * Payload's built-in REST API does not support ranked FTS with highlighted excerpts,
 * so this endpoint executes raw SQL against the same database connection pool.
 *
 * Query params:
 *   q           – free-text search query (required; returns empty if blank)
 *   page        – 1-based page number (default 1)
 *   limit       – results per page, max 50 (default 20)
 *   court       – court UUID to filter by
 *   courtType   – court_type enum value (municipal | county | commercial | misdemeanour | supreme | constitutional)
 *   decisionType – decision_type value (presuda | rjesenje | odluka)
 *   category    – category value (kazneno | gradjansko | upravno | prekrsajno | trgovacko)
 *   from        – ISO date string, lower bound on date
 *   to          – ISO date string, upper bound on date
 */

import { Router, Request, Response } from 'express'

export function createDecisionsSearchRouter(payload: any) {
  const router = Router()

  router.get('/decisions/search', async (req: Request, res: Response) => {
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

    if (!q) {
      return res.json({ docs: [], totalDocs: 0, page, limit, totalPages: 0 })
    }

    try {
      const pool = payload.db.pool as {
        query: (sql: string, params: (string | number)[]) => Promise<{ rows: any[] }>
      }

      // Build dynamic WHERE conditions.
      // $1 is always the search query (plainto_tsquery).
      const conditions: string[] = []
      const params: (string | number)[] = [q]
      let pIdx = 2 // next parameter index

      // Full-text search condition: query the precomputed search_vector text column
      // via to_tsvector so we benefit from the GIN index on that column (see db init SQL).
      conditions.push(
        `to_tsvector('simple', coalesce(cd.search_vector, '') || ' ' || coalesce(cd.title_hr, '') || ' ' || coalesce(cd.case_number, '')) @@ plainto_tsquery('simple', $1)`,
      )

      if (courtId) {
        conditions.push(`cd.court_id = $${pIdx++}`)
        params.push(courtId)
      }

      if (decisionType) {
        conditions.push(`cd.decision_type = $${pIdx++}`)
        params.push(decisionType)
      }

      if (category) {
        conditions.push(`cd.category = $${pIdx++}`)
        params.push(category)
      }

      if (from) {
        conditions.push(`cd.date >= $${pIdx++}`)
        params.push(from)
      }

      if (to) {
        conditions.push(`cd.date <= $${pIdx++}`)
        params.push(to)
      }

      if (courtType) {
        conditions.push(`c.court_type = $${pIdx++}`)
        params.push(courtType)
      }

      const where = conditions.join(' AND ')

      // Count query (reuses same params, no LIMIT/OFFSET yet)
      const countResult = await pool.query(
        `SELECT COUNT(*) AS total
         FROM court_decisions cd
         LEFT JOIN courts c ON cd.court_id = c.id
         WHERE ${where}`,
        params,
      )
      const totalDocs = parseInt(countResult.rows[0]?.total ?? '0', 10)

      // Data query – add LIMIT and OFFSET as the last two parameters
      const dataParams: (string | number)[] = [...params, limit, offset]
      const limitPIdx = pIdx
      const offsetPIdx = pIdx + 1

      const dataResult = await pool.query(
        `SELECT
           cd.id,
           cd.title_hr,
           cd.case_number,
           cd.date,
           cd.decision_type,
           cd.category,
           cd.slug,
           c.id     AS court_id,
           c.name_hr AS court_name,
           ts_rank(
             to_tsvector('simple',
               coalesce(cd.search_vector, '') || ' ' ||
               coalesce(cd.title_hr, '') || ' ' ||
               coalesce(cd.case_number, '')
             ),
             plainto_tsquery('simple', $1)
           ) AS rank,
           ts_headline(
             'simple',
             coalesce(cd.search_vector, cd.title_hr, ''),
             plainto_tsquery('simple', $1),
             'MaxFragments=1, MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>'
           ) AS excerpt
         FROM court_decisions cd
         LEFT JOIN courts c ON cd.court_id = c.id
         WHERE ${where}
         ORDER BY rank DESC, cd.date DESC
         LIMIT $${limitPIdx} OFFSET $${offsetPIdx}`,
        dataParams,
      )

      const totalPages = Math.ceil(totalDocs / limit)

      return res.json({
        docs: dataResult.rows.map((row) => ({
          id: row.id,
          title: row.title_hr,
          caseNumber: row.case_number,
          date: row.date,
          decisionType: row.decision_type,
          category: row.category,
          slug: row.slug,
          court: row.court_id ? { id: row.court_id, name: row.court_name } : null,
          excerpt: row.excerpt ?? null,
          rank: row.rank,
        })),
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      })
    } catch (err) {
      payload.logger.error('decisions-search error:', err)
      return res.status(500).json({ error: 'Interna pogreška servera' })
    }
  })

  return router
}
