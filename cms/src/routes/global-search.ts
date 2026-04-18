/**
 * GET /api/search?q=...
 *
 * Global search across all public content types (FR-033).
 *
 * Returns results grouped by collection type with ranked relevance:
 *   • court-decisions  — PostgreSQL tsvector FTS with `croatian` config
 *                        (unaccent strips č/ć→c, š→s, đ→d, ž→z) + ts_rank
 *   • expert-witnesses — pg_trgm fuzzy name similarity via unaccent()
 *   • interpreters     — pg_trgm fuzzy name similarity via unaccent()
 *   • courts           — pg_trgm fuzzy name similarity via unaccent()
 *   • news-posts       — tsvector FTS with `croatian` config on title
 *
 * When query is empty (< 2 chars) returns recently published content instead.
 *
 * Query params:
 *   q    – search term (min 2 chars to trigger search)
 *   type – optional filter: decisions | experts | interpreters | courts | news
 */

import { Router, Request, Response } from 'express'
import { croatianSearch } from '../search/croatianSearch.js'

export function createGlobalSearchRouter(payload: any) {
  const router = Router()

  router.get('/search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim()
    const typeFilter = req.query.type ? String(req.query.type) : null

    // -------------------------------------------------------------------------
    // Empty query → return recently published content
    // -------------------------------------------------------------------------
    if (q.length < 2) {
      const [recentDecisions, recentNews] = await Promise.allSettled([
        payload.find({
          collection: 'court-decisions',
          limit: 3,
          sort: '-date',
        }),
        payload.find({
          collection: 'news-posts',
          limit: 3,
          sort: '-publishedAt',
        }),
      ])

      return res.json({
        query: q,
        results: {
          decisions:
            recentDecisions.status === 'fulfilled'
              ? { docs: recentDecisions.value.docs, total: recentDecisions.value.totalDocs }
              : { docs: [], total: 0 },
          experts:      { docs: [], total: 0 },
          interpreters: { docs: [], total: 0 },
          courts:       { docs: [], total: 0 },
          news:
            recentNews.status === 'fulfilled'
              ? { docs: recentNews.value.docs, total: recentNews.value.totalDocs }
              : { docs: [], total: 0 },
        },
      })
    }

    // -------------------------------------------------------------------------
    // Full query → Croatian FTS + trigram search via raw SQL
    // -------------------------------------------------------------------------
    try {
      const pool = payload.db.pool as {
        query: (sql: string, params: (string | number)[]) => Promise<{ rows: any[] }>
      }

      const results = await croatianSearch(pool, q, typeFilter)

      return res.json({
        query: q,
        results,
      })
    } catch (err) {
      payload.logger.error('global-search error:', err)
      return res.status(500).json({ error: 'Interna pogreška servera' })
    }
  })

  return router
}
