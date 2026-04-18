/**
 * Public REST API v1 — Sudačka Mreža
 *
 * Exposes Croatian judicial data to partner institutions (Serbia, Macedonia)
 * and other third-party consumers.
 *
 * Base path (when mounted at /api): /api/v1
 *
 * Endpoints:
 *   GET /api/v1/decisions         paginated decisions, filterable by court/date/category
 *   GET /api/v1/decisions/:id     single decision with full text
 *   GET /api/v1/experts           paginated expert witness directory
 *   GET /api/v1/interpreters      paginated interpreter directory
 *   GET /api/v1/courts            courts directory
 *   GET /api/v1/statistics        aggregate counts
 *
 * Rate limits:
 *   Anonymous:  100 req/min per IP
 *   API key:    rateLimit field from ApiKeys collection (default 1 000 req/min)
 *
 * Authentication (optional):
 *   X-API-Key: <key>  header   OR   ?apiKey=<key>  query param
 *
 * CORS: all origins (public API)
 */

import { Router, type Request, type Response, type NextFunction } from 'express'

// ── Rate limit store ──────────────────────────────────────────────────────────

const ANON_LIMIT = 100
const KEY_DEFAULT_LIMIT = 1_000
const WINDOW_MS = 60_000 // 1 minute

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rlStore = new Map<string, RateLimitEntry>()

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = rlStore.get(key)
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rlStore.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// Evict expired windows every minute to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [k, e] of rlStore) {
    if (now - e.windowStart >= WINDOW_MS) rlStore.delete(k)
  }
}, WINDOW_MS)

// ── Statistics cache (1 h TTL) ────────────────────────────────────────────────

interface CacheEntry {
  data: unknown
  expiresAt: number
}
let statsCache: CacheEntry | null = null
const STATS_CACHE_TTL_MS = 60 * 60 * 1_000

// ── Router factory ────────────────────────────────────────────────────────────

export function createPublicApiRouter(payload: any) {
  const router = Router()

  type Pool = {
    query: (
      sql: string,
      params?: (string | number | boolean)[],
    ) => Promise<{ rows: any[] }>
  }
  const pool = (): Pool => payload.db.pool

  // CORS headers on all /v1/* requests
  router.use('/v1', (_req: Request, res: Response, next: NextFunction) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'X-API-Key, Content-Type')
    next()
  })

  // Handle OPTIONS preflight for all /v1/* routes
  router.options('/v1/*', (_req: Request, res: Response) => res.sendStatus(204))

  // ── Rate-limit middleware ─────────────────────────────────────────────────
  // Validates optional API key then enforces per-window request count.
  // Defined as a regular function so the router.get() signature stays clean;
  // async work happens inside a promise chain with all paths guarded.
  function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const ip = String(
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown',
    )

    const rawKey =
      (req.headers['x-api-key'] as string | undefined) ||
      (req.query.apiKey as string | undefined)

    // No key → immediate anon check (sync, no DB round-trip)
    if (!rawKey) {
      if (!checkRateLimit(`ip:${ip}`, ANON_LIMIT)) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${ANON_LIMIT} requests per minute. Request an API key for higher limits.`,
        })
        return
      }
      next()
      return
    }

    // Key provided → look it up then decide limit
    payload
      .find({
        collection: 'api-keys',
        where: { and: [{ key: { equals: rawKey } }, { active: { equals: true } }] },
        limit: 1,
        depth: 0,
      })
      .then((result: any) => {
        const keyDoc = result.docs[0]
        const limit = keyDoc?.rateLimit ?? KEY_DEFAULT_LIMIT
        const rlKey = keyDoc ? `key:${rawKey}` : `ip:${ip}`
        const effectiveLimit = keyDoc ? limit : ANON_LIMIT

        if (!checkRateLimit(rlKey, effectiveLimit)) {
          res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Maximum ${effectiveLimit} requests per minute.`,
          })
          return
        }
        next()
      })
      .catch(() => {
        // Key lookup failed — fall back to anonymous limit
        if (!checkRateLimit(`ip:${ip}`, ANON_LIMIT)) {
          res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Maximum ${ANON_LIMIT} requests per minute.`,
          })
          return
        }
        next()
      })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/decisions
  //
  // Query params:
  //   page     (default 1)
  //   limit    (default 20, max 100)
  //   court    court UUID
  //   category kazneno | gradjansko | upravno | prekrsajno | trgovacko
  //   from     ISO date lower bound (inclusive)
  //   to       ISO date upper bound (inclusive)
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/decisions', rateLimit, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)))
    const offset = (page - 1) * limit

    const courtId = req.query.court ? String(req.query.court) : null
    const category = req.query.category ? String(req.query.category) : null
    const from = req.query.from ? String(req.query.from) : null
    const to = req.query.to ? String(req.query.to) : null

    try {
      const conds: string[] = []
      const params: (string | number)[] = []
      let idx = 1

      if (courtId) { conds.push(`cd.court_id = $${idx++}`); params.push(courtId) }
      if (category) { conds.push(`cd.category = $${idx++}`); params.push(category) }
      if (from) { conds.push(`cd.date >= $${idx++}`); params.push(from) }
      if (to) { conds.push(`cd.date <= $${idx++}`); params.push(to) }

      const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const [countRes, dataRes] = await Promise.all([
        pool().query(
          `SELECT COUNT(*) AS total
           FROM court_decisions cd
           ${whereClause}`,
          params,
        ),
        pool().query(
          `SELECT cd.id,
                  cd.title,
                  cd.case_number,
                  cd.date,
                  cd.decision_type,
                  cd.category,
                  cd.slug,
                  c.id   AS court_id,
                  c.name AS court_name,
                  c.type AS court_type
           FROM court_decisions cd
           LEFT JOIN courts c ON cd.court_id = c.id
           ${whereClause}
           ORDER BY cd.date DESC NULLS LAST, cd.id DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, limit, offset],
        ),
      ])

      const totalDocs = parseInt(countRes.rows[0]?.total ?? '0', 10)
      const totalPages = Math.ceil(totalDocs / limit)

      return res.json({
        docs: dataRes.rows.map((r) => ({
          id: r.id,
          title: r.title,
          caseNumber: r.case_number,
          date: r.date,
          decisionType: r.decision_type,
          category: r.category,
          slug: r.slug,
          court: r.court_id
            ? { id: r.court_id, name: r.court_name, type: r.court_type }
            : null,
        })),
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      })
    } catch (err) {
      payload.logger.error('publicApi /v1/decisions error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/decisions/:id
  //
  // :id may be the UUID or the slug.
  // Returns full decision text alongside metadata.
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/decisions/:id', rateLimit, async (req: Request, res: Response) => {
    const { id } = req.params

    try {
      const result = await pool().query(
        `SELECT cd.id,
                cd.title,
                cd.case_number,
                cd.date,
                cd.decision_type,
                cd.category,
                cd.slug,
                cd.full_text,
                cd.summary,
                cd.search_vector AS text_content,
                c.id   AS court_id,
                c.name AS court_name,
                c.type AS court_type,
                c.city AS court_city
         FROM court_decisions cd
         LEFT JOIN courts c ON cd.court_id = c.id
         WHERE cd.id::text = $1 OR cd.slug = $1
         LIMIT 1`,
        [String(id)],
      )

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Decision not found' })
      }

      const r = result.rows[0]
      return res.json({
        id: r.id,
        title: r.title,
        caseNumber: r.case_number,
        date: r.date,
        decisionType: r.decision_type,
        category: r.category,
        slug: r.slug,
        // textContent: plain-text extracted by generateSearchIndex hook (for easy indexing)
        textContent: r.text_content ?? null,
        // richText: Lexical JSON (for rich rendering)
        richText: r.full_text ?? null,
        summary: r.summary ?? null,
        court: r.court_id
          ? { id: r.court_id, name: r.court_name, type: r.court_type, city: r.court_city }
          : null,
      })
    } catch (err) {
      payload.logger.error('publicApi /v1/decisions/:id error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/experts
  //
  // Query params: page, limit, county, verified (true|false)
  // Note: phone and email are omitted — member-only PII fields.
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/experts', rateLimit, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)))
    const offset = (page - 1) * limit

    const county = req.query.county ? String(req.query.county) : null
    const verifiedParam = req.query.verified
    const verified =
      verifiedParam === 'true' ? true : verifiedParam === 'false' ? false : null

    try {
      const conds: string[] = []
      const params: (string | number | boolean)[] = []
      let idx = 1

      if (county) { conds.push(`ew.county = $${idx++}`); params.push(county) }
      if (verified !== null) { conds.push(`ew.verified = $${idx++}`); params.push(verified) }

      const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const [countRes, dataRes] = await Promise.all([
        pool().query(
          `SELECT COUNT(*) AS total FROM expert_witnesses ew ${whereClause}`,
          params,
        ),
        pool().query(
          `SELECT ew.id, ew.name, ew.county, ew.city, ew.verified, ew.verified_at, ew.lang, ew.slug
           FROM expert_witnesses ew
           ${whereClause}
           ORDER BY ew.name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, limit, offset],
        ),
      ])

      const totalDocs = parseInt(countRes.rows[0]?.total ?? '0', 10)
      const totalPages = Math.ceil(totalDocs / limit)

      return res.json({
        docs: dataRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          county: r.county,
          city: r.city,
          verified: r.verified,
          verifiedAt: r.verified_at,
          lang: r.lang,
          slug: r.slug,
        })),
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      })
    } catch (err) {
      payload.logger.error('publicApi /v1/experts error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/interpreters
  //
  // Query params: page, limit, county, verified (true|false)
  // Note: phone and email are omitted — member-only PII fields.
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/interpreters', rateLimit, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)))
    const offset = (page - 1) * limit

    const county = req.query.county ? String(req.query.county) : null
    const verifiedParam = req.query.verified
    const verified =
      verifiedParam === 'true' ? true : verifiedParam === 'false' ? false : null

    try {
      const conds: string[] = []
      const params: (string | number | boolean)[] = []
      let idx = 1

      if (county) { conds.push(`i.county = $${idx++}`); params.push(county) }
      if (verified !== null) { conds.push(`i.verified = $${idx++}`); params.push(verified) }

      const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const [countRes, dataRes] = await Promise.all([
        pool().query(
          `SELECT COUNT(*) AS total FROM interpreters i ${whereClause}`,
          params,
        ),
        pool().query(
          `SELECT i.id, i.name, i.county, i.city, i.verified, i.verified_at, i.lang, i.slug
           FROM interpreters i
           ${whereClause}
           ORDER BY i.name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, limit, offset],
        ),
      ])

      const totalDocs = parseInt(countRes.rows[0]?.total ?? '0', 10)
      const totalPages = Math.ceil(totalDocs / limit)

      return res.json({
        docs: dataRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          county: r.county,
          city: r.city,
          verified: r.verified,
          verifiedAt: r.verified_at,
          lang: r.lang,
          slug: r.slug,
        })),
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      })
    } catch (err) {
      payload.logger.error('publicApi /v1/interpreters error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/courts
  //
  // Query params:
  //   page    (default 1)
  //   limit   (default 50, max 200)
  //   type    municipal | county | commercial | misdemeanour |
  //           high_commercial | supreme | administrative | constitutional
  //   county  county name string
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/courts', rateLimit, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)))
    const offset = (page - 1) * limit

    const type = req.query.type ? String(req.query.type) : null
    const county = req.query.county ? String(req.query.county) : null

    try {
      const conds: string[] = []
      const params: (string | number)[] = []
      let idx = 1

      if (type) { conds.push(`c.type = $${idx++}`); params.push(type) }
      if (county) { conds.push(`c.county = $${idx++}`); params.push(county) }

      const whereClause = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const [countRes, dataRes] = await Promise.all([
        pool().query(
          `SELECT COUNT(*) AS total FROM courts c ${whereClause}`,
          params,
        ),
        pool().query(
          `SELECT c.id, c.name, c.type, c.city, c.county,
                  c.address, c.phone, c.fax, c.email, c.website,
                  c.president, c.lat, c.lng, c.slug
           FROM courts c
           ${whereClause}
           ORDER BY c.name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, limit, offset],
        ),
      ])

      const totalDocs = parseInt(countRes.rows[0]?.total ?? '0', 10)
      const totalPages = Math.ceil(totalDocs / limit)

      return res.json({
        docs: dataRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          city: r.city,
          county: r.county,
          address: r.address ?? null,
          phone: r.phone ?? null,
          fax: r.fax ?? null,
          email: r.email ?? null,
          website: r.website ?? null,
          president: r.president ?? null,
          coordinates:
            r.lat != null && r.lng != null
              ? { lat: parseFloat(r.lat), lng: parseFloat(r.lng) }
              : null,
          slug: r.slug,
        })),
        totalDocs,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      })
    } catch (err) {
      payload.logger.error('publicApi /v1/courts error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/v1/statistics
  //
  // Aggregate counts across all major collections.
  // Cached in-process for 1 hour.
  // ────────────────────────────────────────────────────────────────────────────
  router.get('/v1/statistics', rateLimit, async (_req: Request, res: Response) => {
    if (statsCache && Date.now() < statsCache.expiresAt) {
      return res.json(statsCache.data)
    }

    try {
      const [decisionsRes, courtsRes, expertsRes, interpretersRes] = await Promise.all([
        pool().query('SELECT COUNT(*) AS total FROM court_decisions'),
        pool().query('SELECT COUNT(*) AS total FROM courts'),
        pool().query('SELECT COUNT(*) AS total FROM expert_witnesses'),
        pool().query('SELECT COUNT(*) AS total FROM interpreters'),
      ])

      const data = {
        totals: {
          decisions: parseInt(decisionsRes.rows[0]?.total ?? '0', 10),
          courts: parseInt(courtsRes.rows[0]?.total ?? '0', 10),
          experts: parseInt(expertsRes.rows[0]?.total ?? '0', 10),
          interpreters: parseInt(interpretersRes.rows[0]?.total ?? '0', 10),
        },
      }

      statsCache = { data, expiresAt: Date.now() + STATS_CACHE_TTL_MS }
      return res.json(data)
    } catch (err) {
      payload.logger.error('publicApi /v1/statistics error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
