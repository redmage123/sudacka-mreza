/**
 * GET /api/search
 *
 * Global search across all public content types: court decisions, expert witnesses,
 * courts, and news posts (FR-033).
 *
 * Returns results grouped by type, top 3 per group, with total counts.
 * When query is empty, returns recently added content instead.
 *
 * Query params:
 *   q    – search term (min 2 chars to trigger search)
 *   type – optional filter: decisions | experts | courts | news
 */

import { Router, Request, Response } from 'express'

export function createGlobalSearchRouter(payload: any) {
  const router = Router()

  router.get('/search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim()
    const typeFilter = req.query.type ? String(req.query.type) : null

    // Empty query → return recent content
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
          experts: { docs: [], total: 0 },
          courts: { docs: [], total: 0 },
          news:
            recentNews.status === 'fulfilled'
              ? { docs: recentNews.value.docs, total: recentNews.value.totalDocs }
              : { docs: [], total: 0 },
        },
      })
    }

    // Build collection queries based on optional type filter
    const shouldSearch = (type: string) => !typeFilter || typeFilter === type

    const searches = await Promise.allSettled([
      shouldSearch('decisions')
        ? payload.find({
            collection: 'court-decisions',
            where: {
              or: [{ title_hr: { like: q } }, { caseNumber: { like: q } }],
            },
            limit: typeFilter === 'decisions' ? 20 : 3,
          })
        : Promise.resolve(null),

      shouldSearch('experts')
        ? payload.find({
            collection: 'expert-witnesses',
            where: {
              or: [{ name: { like: q } }, { county: { like: q } }],
            },
            limit: typeFilter === 'experts' ? 20 : 3,
          })
        : Promise.resolve(null),

      shouldSearch('courts')
        ? payload.find({
            collection: 'courts',
            where: {
              or: [{ name_hr: { like: q } }, { name_en: { like: q } }],
            },
            limit: typeFilter === 'courts' ? 20 : 3,
          })
        : Promise.resolve(null),

      shouldSearch('news')
        ? payload.find({
            collection: 'news-posts',
            where: { title_hr: { like: q } },
            limit: typeFilter === 'news' ? 20 : 3,
          })
        : Promise.resolve(null),
    ])

    const [decisionsResult, expertsResult, courtsResult, newsResult] = searches

    function extract(result: PromiseSettledResult<any>) {
      if (result.status === 'rejected' || result.value === null) {
        return { docs: [], total: 0 }
      }
      return {
        docs: result.value.docs,
        total: result.value.totalDocs,
      }
    }

    return res.json({
      query: q,
      results: {
        decisions: extract(decisionsResult),
        experts: extract(expertsResult),
        courts: extract(courtsResult),
        news: extract(newsResult),
      },
    })
  })

  return router
}
