/**
 * GET /api/statistics
 *
 * Aggregated judicial statistics for the Statistics Dashboard.
 * Results are cached in-process for 1 hour to avoid DB pressure on every page load.
 *
 * Returns:
 *   totals                   – total count of decisions, courts, experts, interpreters
 *   decisionsPerCourtPerYear – per-court per-year breakdown (top 10 courts, last 5 years)
 *   decisionsByType          – distribution across decision type enum values
 *   monthlyTrend             – monthly decision counts for the last 24 months
 *   topCourts                – most active courts ranked by total decisions
 *   expertsBySpecialty       – expert witness count grouped by speciality area
 */

import { Router, type Request, type Response } from 'express'

interface CacheEntry {
  data: unknown
  expiresAt: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export function createStatisticsRouter(payload: any) {
  const router = Router()

  router.get('/statistics', async (_req: Request, res: Response) => {
    // Serve stale-free cached result while still fresh
    if (cache && Date.now() < cache.expiresAt) {
      return res.json(cache.data)
    }

    try {
      const pool = payload.db.pool as {
        query: (sql: string, params?: (string | number)[]) => Promise<{ rows: any[] }>
      }

      // Run all independent queries concurrently
      const [
        decisionsCountResult,
        courtsCountResult,
        expertsCountResult,
        interpretersCountResult,
        decisionsByTypeResult,
        monthlyTrendResult,
        topCourtsResult,
        decisionsPerCourtPerYearResult,
      ] = await Promise.all([
        // Total counts
        pool.query('SELECT COUNT(*) AS total FROM court_decisions'),
        pool.query('SELECT COUNT(*) AS total FROM courts'),
        pool.query('SELECT COUNT(*) AS total FROM expert_witnesses'),
        pool.query('SELECT COUNT(*) AS total FROM interpreters'),

        // Decisions by type (decision_type enum — cast to text so COALESCE works)
        pool.query(`
          SELECT
            COALESCE(decision_type::text, 'unknown') AS type,
            COUNT(*)::int                            AS count
          FROM court_decisions
          GROUP BY decision_type
          ORDER BY count DESC
        `),

        // Monthly trend – last 24 months
        pool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
            COUNT(*)::int                                  AS count
          FROM court_decisions
          WHERE date >= NOW() - INTERVAL '24 months'
            AND date IS NOT NULL
          GROUP BY DATE_TRUNC('month', date)
          ORDER BY DATE_TRUNC('month', date) ASC
        `),

        // Top 15 courts by total decisions
        pool.query(`
          SELECT
            c.name     AS court,
            c.type     AS court_type,
            COUNT(cd.id)::int AS count
          FROM courts c
          LEFT JOIN court_decisions cd ON cd.court_id = c.id
          GROUP BY c.id, c.name, c.type
          ORDER BY count DESC
          LIMIT 15
        `),

        // Top 8 courts × last 5 years for grouped bar chart
        pool.query(`
          WITH top_courts AS (
            SELECT court_id
            FROM court_decisions
            WHERE date IS NOT NULL
            GROUP BY court_id
            ORDER BY COUNT(*) DESC
            LIMIT 8
          )
          SELECT
            c.name                           AS court,
            EXTRACT(YEAR FROM cd.date)::int  AS year,
            COUNT(*)::int                    AS count
          FROM court_decisions cd
          JOIN courts c ON c.id = cd.court_id
          WHERE cd.court_id IN (SELECT court_id FROM top_courts)
            AND cd.date IS NOT NULL
            AND EXTRACT(YEAR FROM cd.date) >= EXTRACT(YEAR FROM NOW()) - 4
          GROUP BY c.name, EXTRACT(YEAR FROM cd.date)
          ORDER BY year, count DESC
        `),
      ])

      // Expert witnesses by speciality area (array sub-table)
      let expertsBySpecialty: Array<{ specialty: string; count: number }> = []
      try {
        const r = await pool.query(`
          SELECT
            ewa.area         AS specialty,
            COUNT(DISTINCT ewa._parent_id)::int AS count
          FROM expert_witnesses_speciality_areas ewa
          GROUP BY ewa.area
          ORDER BY count DESC
          LIMIT 20
        `)
        expertsBySpecialty = r.rows.map((row) => ({
          specialty: row.specialty,
          count: row.count,
        }))
      } catch {
        // Table may not exist if no data has been seeded yet — return empty gracefully
        expertsBySpecialty = []
      }

      const data = {
        totals: {
          decisions: parseInt(decisionsCountResult.rows[0]?.total ?? '0', 10),
          courts: parseInt(courtsCountResult.rows[0]?.total ?? '0', 10),
          experts: parseInt(expertsCountResult.rows[0]?.total ?? '0', 10),
          interpreters: parseInt(interpretersCountResult.rows[0]?.total ?? '0', 10),
        },
        decisionsByType: decisionsByTypeResult.rows.map((r) => ({
          type: r.type as string,
          count: r.count as number,
        })),
        monthlyTrend: monthlyTrendResult.rows.map((r) => ({
          month: r.month as string,
          count: r.count as number,
        })),
        topCourts: topCourtsResult.rows.map((r) => ({
          court: r.court as string,
          courtType: r.court_type as string,
          count: r.count as number,
        })),
        decisionsPerCourtPerYear: decisionsPerCourtPerYearResult.rows.map((r) => ({
          court: r.court as string,
          year: r.year as number,
          count: r.count as number,
        })),
        expertsBySpecialty,
      }

      cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
      return res.json(data)
    } catch (err) {
      payload.logger.error('statistics error:', err)
      return res.status(500).json({ error: 'Interna pogreška servera' })
    }
  })

  return router
}
