/**
 * Route handler unit tests
 *
 * Tests for:
 *   - decisions-search.ts  (AC-ROUTE-001 – AC-ROUTE-005)
 *   - global-search.ts     (AC-ROUTE-006 – AC-ROUTE-008)
 *   - court-fee.ts         (AC-ROUTE-009 – AC-ROUTE-013)
 *   - jurisdiction.ts      (AC-ROUTE-014 – AC-ROUTE-019)
 *
 * Each suite creates a minimal Express app — the full Payload server is NOT started.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// fs mock — must be declared before route imports so Vitest hoists it.
// We preserve the original module so that Express internal fs usage is unaffected.
// ---------------------------------------------------------------------------
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() }
})

// Route imports (ESM-style with .js extensions as required by the project)
import { createDecisionsSearchRouter } from '../routes/decisions-search.js'
import { createGlobalSearchRouter } from '../routes/global-search.js'
import courtFeeRouter from '../routes/court-fee.js'
import { createJurisdictionRouter } from '../routes/jurisdiction.js'
import * as fs from 'fs'

// ---------------------------------------------------------------------------
// GeoJSON fixture — lng 15.5–16.5, lat 45.5–46.5 square around Zagreb
// ---------------------------------------------------------------------------
const GEOJSON_FIXTURE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        jurisdictionName: 'Općinski sud u Zagrebu',
        courtId: 'court-1',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [15.5, 45.5],
            [16.5, 45.5],
            [16.5, 46.5],
            [15.5, 46.5],
            [15.5, 45.5],
          ],
        ],
      },
    },
  ],
})

// ---------------------------------------------------------------------------
// 1. decisions-search route tests (AC-ROUTE-001 – AC-ROUTE-005)
// ---------------------------------------------------------------------------
describe('decisions-search route', () => {
  const mockPool = { query: vi.fn() }
  const mockPayload = { db: { pool: mockPool }, logger: { error: vi.fn() } }

  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createDecisionsSearchRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-ROUTE-001: empty q → short-circuit, pool.query NOT called
  it('AC-ROUTE-001: absent q → 200 with empty docs, pool.query not called', async () => {
    const res = await request(app).get('/api/decisions/search')
    expect(res.status).toBe(200)
    expect(res.body.docs).toEqual([])
    expect(res.body.totalDocs).toBe(0)
    expect(res.body.totalPages).toBe(0)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('AC-ROUTE-001: empty string q → 200 with empty docs, pool.query not called', async () => {
    const res = await request(app).get('/api/decisions/search?q=')
    expect(res.status).toBe(200)
    expect(res.body.docs).toEqual([])
    expect(res.body.totalDocs).toBe(0)
    expect(res.body.totalPages).toBe(0)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  // AC-ROUTE-001: page and limit are returned in the short-circuit response
  it('AC-ROUTE-001: page/limit reflected in short-circuit response', async () => {
    const res = await request(app).get('/api/decisions/search?q=&page=2&limit=10')
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(2)
    expect(res.body.limit).toBe(10)
  })

  // AC-ROUTE-002: non-empty q → pool.query called twice, SQL contains plainto_tsquery
  it('AC-ROUTE-002: non-empty q → pool.query called twice; SQL contains plainto_tsquery', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // count
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            title: 'Test odluka',
            case_number: 'Gž-123/24',
            date: '2024-03-01',
            decision_type: 'presuda',
            category: 'gradjansko',
            slug: 'test-odluka',
            court_id: 'c1',
            court_name: 'Općinski sud',
            rank: 0.1,
            excerpt: '<mark>Test</mark> odluka',
          },
        ],
      }) // data

    const res = await request(app).get('/api/decisions/search?q=test')
    expect(res.status).toBe(200)
    expect(mockPool.query).toHaveBeenCalledTimes(2)

    const [countSql] = mockPool.query.mock.calls[0]
    expect(countSql).toContain("plainto_tsquery('croatian', $1)")

    const [dataSql] = mockPool.query.mock.calls[1]
    expect(dataSql).toContain("plainto_tsquery('croatian', $1)")

    // docs[].rank and docs[].excerpt are present
    expect(typeof res.body.docs[0].rank).toBe('number')
    expect(res.body.docs[0].excerpt).toBe('<mark>Test</mark> odluka')
  })

  // AC-ROUTE-003: limit capped at 50, page floored at 1, offset = (page-1)*limit
  it('AC-ROUTE-003: limit capped at 50', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/api/decisions/search?q=test&limit=999')
    expect(res.status).toBe(200)
    expect(res.body.limit).toBe(50)

    // LIMIT param in data query = 50
    const dataParams = mockPool.query.mock.calls[1][1]
    expect(dataParams[dataParams.length - 2]).toBe(50)
  })

  it('AC-ROUTE-003: page floored at 1 when page=0', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/api/decisions/search?q=test&page=0')
    expect(res.body.page).toBe(1)
  })

  it('AC-ROUTE-003: offset = (page-1)*limit in data query params', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    // page=3, limit=10 → offset=20
    await request(app).get('/api/decisions/search?q=test&page=3&limit=10')
    const dataParams = mockPool.query.mock.calls[1][1]
    const offset = dataParams[dataParams.length - 1]
    const limit = dataParams[dataParams.length - 2]
    expect(limit).toBe(10)
    expect(offset).toBe(20)
  })

  // AC-ROUTE-004: filter params append correct SQL conditions
  it('AC-ROUTE-004: ?court=uuid appends cd.court_id=$N', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/decisions/search?q=test&court=some-uuid')
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('cd.court_id = $2')
    expect(countParams).toContain('some-uuid')
  })

  it('AC-ROUTE-004: ?courtType=municipal appends c.type=$N', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/decisions/search?q=test&courtType=municipal')
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('c.type = $2')
    expect(countParams).toContain('municipal')
  })

  it('AC-ROUTE-004: ?from=2024-01-01&to=2024-12-31 appends both date bounds', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get(
      '/api/decisions/search?q=test&from=2024-01-01&to=2024-12-31',
    )
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('cd.date >= $2')
    expect(countSql).toContain('cd.date <= $3')
    expect(countParams).toContain('2024-01-01')
    expect(countParams).toContain('2024-12-31')
  })

  it('AC-ROUTE-004: ?decisionType=presuda appends cd.decision_type=$N', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/decisions/search?q=test&decisionType=presuda')
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('cd.decision_type = $2')
    expect(countParams).toContain('presuda')
  })

  it('AC-ROUTE-004: ?category=gradjansko appends cd.category=$N', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/decisions/search?q=test&category=gradjansko')
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('cd.category = $2')
    expect(countParams).toContain('gradjansko')
  })

  // AC-ROUTE-005: pool.query rejects → 500 with Croatian error message
  it('AC-ROUTE-005: pool.query rejects → 500 with Interna pogreška servera', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'))

    const res = await request(app).get('/api/decisions/search?q=test')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Interna pogreška servera')
  })
})

// ---------------------------------------------------------------------------
// 2. global-search route tests (AC-ROUTE-006 – AC-ROUTE-008)
//
// NOTE: global-search uses raw SQL via croatianSearch(pool, q, typeFilter) for
// queries with q >= 2 chars. Tests below mock payload.db.pool.query accordingly.
// The q < 2 short-circuit still uses payload.find.
// ---------------------------------------------------------------------------
describe('global-search route', () => {
  const mockPool = { query: vi.fn() }
  const mockPayload = {
    find: vi.fn(),
    db: { pool: mockPool },
    logger: { error: vi.fn(), warn: vi.fn() },
  }

  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createGlobalSearchRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AC-ROUTE-006: q < 2 chars → short-circuit uses payload.find for decisions + news
  it('AC-ROUTE-006: single-char q → recent decisions and news; experts and courts empty', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ id: 'd1' }], totalDocs: 1 }) // court-decisions
      .mockResolvedValueOnce({ docs: [{ id: 'n1' }], totalDocs: 1 }) // news-posts

    const res = await request(app).get('/api/search?q=a')
    expect(res.status).toBe(200)

    expect(mockPayload.find).toHaveBeenCalledTimes(2)

    const firstCall = mockPayload.find.mock.calls[0][0]
    expect(firstCall.collection).toBe('court-decisions')
    expect(firstCall.sort).toBe('-date')
    expect(firstCall.limit).toBe(3)

    const secondCall = mockPayload.find.mock.calls[1][0]
    expect(secondCall.collection).toBe('news-posts')
    expect(secondCall.sort).toBe('-publishedAt')
    expect(secondCall.limit).toBe(3)

    expect(res.body.results.experts).toEqual({ docs: [], total: 0 })
    expect(res.body.results.courts).toEqual({ docs: [], total: 0 })
    expect(res.body.results.decisions.docs).toHaveLength(1)
    expect(res.body.results.news.docs).toHaveLength(1)
  })

  it('AC-ROUTE-006: absent q → same short-circuit behaviour', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    const res = await request(app).get('/api/search')
    expect(res.status).toBe(200)
    expect(mockPayload.find).toHaveBeenCalledTimes(2)
    expect(res.body.results.experts).toEqual({ docs: [], total: 0 })
    expect(res.body.results.courts).toEqual({ docs: [], total: 0 })
  })

  // AC-ROUTE-007: q >= 2 chars + type filter → pool.query called; only that group populated
  it('AC-ROUTE-007: ?q=test&type=courts → pool.query called; only courts populated', async () => {
    // searchByName calls count + data for courts (2 queries)
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })                              // count
      .mockResolvedValueOnce({ rows: [{ id: 'court-1', name: 'Sud Zagreb', rank: 0.8 }] }) // data

    const res = await request(app).get('/api/search?q=test&type=courts')
    expect(res.status).toBe(200)

    expect(res.body.results.decisions).toEqual({ docs: [], total: 0 })
    expect(res.body.results.experts).toEqual({ docs: [], total: 0 })
    expect(res.body.results.news).toEqual({ docs: [], total: 0 })

    expect(res.body.results.courts.docs).toHaveLength(1)
    expect(res.body.results.courts.total).toBe(1)
  })

  it('AC-ROUTE-007: ?q=test&type=decisions → pool.query called; only decisions populated', async () => {
    // searchDecisions calls count + data for decisions (2 queries)
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{
        id: '1', title: 'Test', slug: 'test', case_number: 'Gž-1/24',
        date: '2024-01-01', decision_type: 'civil', rank: 0.5, excerpt: null,
      }] })

    const res = await request(app).get('/api/search?q=test&type=decisions')
    expect(res.status).toBe(200)
    expect(res.body.results.decisions.docs).toHaveLength(1)
    expect(res.body.results.experts).toEqual({ docs: [], total: 0 })
  })

  // AC-ROUTE-008: when one group's queries reject → that group = {docs:[],total:0}; others populated
  it('AC-ROUTE-008: decisions pool.query rejects → decisions empty; others populated', async () => {
    // All 5 groups are queried (no type filter). searchDecisions fails; others succeed.
    // Query call order (parallel, but mockResolvedValueOnce is FIFO):
    //   decisions: count reject (2 calls simulate failure on first)
    //   experts: count + data
    //   interpreters: count + data
    //   courts: count + data
    //   news: count + data
    mockPool.query
      .mockRejectedValueOnce(new Error('decisions count fail'))  // decisions count
      .mockRejectedValueOnce(new Error('decisions data fail'))   // decisions data
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })         // experts count
      .mockResolvedValueOnce({ rows: [{ id: 'e1', name: 'Expert', rank: 0.7 }] }) // experts data
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })         // interpreters count
      .mockResolvedValueOnce({ rows: [] })                       // interpreters data
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })         // courts count
      .mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Sud', rank: 0.6 }] }) // courts data
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })         // news count
      .mockResolvedValueOnce({ rows: [] })                       // news data

    const res = await request(app).get('/api/search?q=somequery')
    expect(res.status).toBe(200)

    expect(res.body.results.decisions).toEqual({ docs: [], total: 0 })
    expect(res.body.results.experts.docs).toHaveLength(1)
    expect(res.body.results.courts.docs).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. court-fee route tests (AC-ROUTE-009 – AC-ROUTE-013)
// ---------------------------------------------------------------------------
describe('court-fee route', () => {
  // court-fee is stateless — safe to create one app for the whole suite
  const app = express().use('/api', courtFeeRouter)

  // AC-ROUTE-009: GET /api/court-fee/types → 200, array of 12, each with required fields
  it('AC-ROUTE-009: /types → 200, 12 items, each has value/label_hr/label_en/tariffRef/multiplier', async () => {
    const res = await request(app).get('/api/court-fee/types')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(12)
    for (const item of res.body) {
      expect(item).toHaveProperty('value')
      expect(item).toHaveProperty('label_hr')
      expect(item).toHaveProperty('label_en')
      expect(item).toHaveProperty('tariffRef')
      expect(item).toHaveProperty('multiplier')
    }
  })

  // AC-ROUTE-010: claimValue=10000, civil_complaint → breakdown fields, total≈76.56, currency=EUR, disclaimer
  it('AC-ROUTE-010: claimValue=10000, civil_complaint → correct breakdown and total', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=10000&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('breakdown')
    expect(res.body.breakdown).toHaveProperty('base')
    expect(res.body.breakdown.multiplier).toBe(1.0)
    expect(res.body.breakdown).toHaveProperty('fee')
    // base = 51.46 + 0.005*(10000-4979.20) = 51.46 + 25.104 = 76.564 → rounded 76.56
    expect(res.body.total).toBeCloseTo(76.56, 1)
    expect(res.body.currency).toBe('EUR')
    expect(res.body).toHaveProperty('disclaimer')
    expect(typeof res.body.disclaimer).toBe('string')
  })

  // AC-ROUTE-011: statutory max capped at 663.61
  it('AC-ROUTE-011: claimValue=10000000, civil_complaint → total=663.61 (statutory max)', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=10000000&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(663.61)
  })

  // AC-ROUTE-012: boundary values for calculateBase
  it('AC-ROUTE-012: claimValue=497.92 → base=6.64', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=497.92&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(200)
    expect(res.body.breakdown.base).toBeCloseTo(6.64, 2)
  })

  it('AC-ROUTE-012: claimValue=4979.20 → base≈51.45 (toBeCloseTo)', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=4979.20&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(200)
    // 6.64 + 0.01*(4979.20-497.92) = 6.64 + 44.8128 = 51.4528 → rounds to 51.45
    expect(res.body.breakdown.base).toBeCloseTo(51.45, 1)
  })

  it('AC-ROUTE-012: claimValue=-1 → 422', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=-1&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(422)
  })

  it('AC-ROUTE-012: claimValue=0 → 200 with total=0 (known limitation: guard is < 0 not <= 0)', async () => {
    // NOTE: This is a known limitation of the implementation. The guard condition
    // is `claimValue < 0`, so claimValue=0 passes validation. calculateBase(0)
    // returns 0 (value <= 0 branch), so total is correctly 0. The semantics of
    // a zero-value claim are legally ambiguous, but the code handles it gracefully.
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=0&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.currency).toBe('EUR')
  })

  // AC-ROUTE-013: missing/invalid inputs → 422
  it('AC-ROUTE-013: missing claimValue → 422', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?proceedingType=civil_complaint',
    )
    expect(res.status).toBe(422)
  })

  it('AC-ROUTE-013: unknown proceedingType → 422 with validTypes array', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=1000&proceedingType=foo',
    )
    expect(res.status).toBe(422)
    expect(Array.isArray(res.body.validTypes)).toBe(true)
    expect(res.body.validTypes.length).toBeGreaterThan(0)
  })

  it('AC-ROUTE-013: claimValue=abc → 422', async () => {
    const res = await request(app).get(
      '/api/court-fee/calculate?claimValue=abc&proceedingType=civil_complaint',
    )
    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// 4. jurisdiction route tests (AC-ROUTE-014 – AC-ROUTE-019)
//
// ISOLATION: Each describe block creates a fresh router via createJurisdictionRouter()
// so that the `features` / `loadError` closure state does not leak between suites.
// ---------------------------------------------------------------------------

// Shared mock payload for all jurisdiction suites
const makeJurisdictionPayload = () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  findByID: vi.fn(),
  find: vi.fn(),
})

// ---------------------------------------------------------------------------
// 4a. Missing lat/lng validation (AC-ROUTE-014)
// We need a working router → mock fs so file loads successfully
// ---------------------------------------------------------------------------
describe('jurisdiction route – missing/invalid lat/lng (AC-ROUTE-014)', () => {
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    // File exists and parses correctly
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(GEOJSON_FIXTURE)

    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AC-ROUTE-014: no lat/lng → 422', async () => {
    const res = await request(app).get('/api/jurisdiction')
    expect(res.status).toBe(422)
  })

  it('AC-ROUTE-014: lat=abc&lng=15.0 → 422', async () => {
    const res = await request(app).get('/api/jurisdiction?lat=abc&lng=15.0')
    expect(res.status).toBe(422)
  })

  it('AC-ROUTE-014: lat=45.0 with no lng → 422', async () => {
    const res = await request(app).get('/api/jurisdiction?lat=45.0')
    expect(res.status).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// 4b. Croatia bounding box checks (AC-ROUTE-015)
// ---------------------------------------------------------------------------
describe('jurisdiction route – bounding box (AC-ROUTE-015)', () => {
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(GEOJSON_FIXTURE)

    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AC-ROUTE-015: lat=51.0&lng=15.0 (north of Croatia) → 422 with Croatian territory message', async () => {
    const res = await request(app).get('/api/jurisdiction?lat=51.0&lng=15.0')
    expect(res.status).toBe(422)
    expect(res.body.error).toContain('outside Croatian territory')
  })

  it('AC-ROUTE-015: lat=44.0&lng=20.0 (east of Croatia) → 422', async () => {
    const res = await request(app).get('/api/jurisdiction?lat=44.0&lng=20.0')
    expect(res.status).toBe(422)
    expect(res.body.error).toContain('outside Croatian territory')
  })

  it('AC-ROUTE-015: lat=42.0&lng=13.5 is NOT outside bounding box (boundary is strict </>)', async () => {
    // The check is lat < 42.0 || lat > 47.0 || lng < 13.5 || lng > 19.5
    // lat=42.0, lng=13.5 pass the check (not strictly less/greater)
    // They are outside the Zagreb polygon → expect 200 or 404, NOT 422
    const res = await request(app).get('/api/jurisdiction?lat=42.0&lng=13.5')
    expect(res.status).not.toBe(422)
  })
})

// ---------------------------------------------------------------------------
// 4c. File missing → 503 (cached error on second request) (AC-ROUTE-016)
// ---------------------------------------------------------------------------
describe('jurisdiction route – missing GeoJSON file (AC-ROUTE-016)', () => {
  // Use ONE shared app/router instance to verify the error is cached
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    // File does not exist
    vi.mocked(fs.existsSync).mockReturnValue(false)

    // Create router ONCE — loadError will be set after first request
    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  it('AC-ROUTE-016: first request → 503 (file not found)', async () => {
    const res = await request(app).get('/api/jurisdiction?lat=46.0&lng=16.0')
    expect(res.status).toBe(503)
  })

  it('AC-ROUTE-016: second request to SAME router → 503 (loadError cached, file not re-attempted)', async () => {
    // existsSync should NOT be called again — error was cached on first call
    const callCountBefore = vi.mocked(fs.existsSync).mock.calls.length
    const res = await request(app).get('/api/jurisdiction?lat=46.0&lng=16.0')
    expect(res.status).toBe(503)
    // existsSync not called again (ensureLoaded early-returns when loadError is set)
    const callCountAfter = vi.mocked(fs.existsSync).mock.calls.length
    expect(callCountAfter).toBe(callCountBefore)
  })
})

// ---------------------------------------------------------------------------
// 4d. No polygon match → 404 (AC-ROUTE-017)
// ---------------------------------------------------------------------------
describe('jurisdiction route – point outside all polygons (AC-ROUTE-017)', () => {
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(GEOJSON_FIXTURE)

    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('AC-ROUTE-017: point inside bounding box but outside all polygons → 404', async () => {
    // lat=43.5, lng=17.0 — inside Croatia bounding box but outside the Zagreb polygon
    const res = await request(app).get('/api/jurisdiction?lat=43.5&lng=17.0')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('No jurisdiction found')
  })
})

// ---------------------------------------------------------------------------
// 4e. Successful match with courtId lookup (AC-ROUTE-018)
// ---------------------------------------------------------------------------
describe('jurisdiction route – successful match with courtId (AC-ROUTE-018)', () => {
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(GEOJSON_FIXTURE)

    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-ROUTE-018: coords inside polygon → payload.findByID called; response has court fields', async () => {
    mockPayload.findByID.mockResolvedValueOnce({
      id: 'court-1',
      name: 'Općinski sud u Zagrebu',
      slug: 'opcinski-sud-zagreb',
      address: 'Trg N. Š. Zrinskog 3, Zagreb',
      phone: '+385 1 4801 111',
      website: 'https://opstizg.hr',
    })

    // lat=46.0, lng=16.0 is inside the fixture polygon
    const res = await request(app).get('/api/jurisdiction?lat=46.0&lng=16.0')
    expect(res.status).toBe(200)

    expect(mockPayload.findByID).toHaveBeenCalledWith({
      collection: 'courts',
      id: 'court-1',
    })

    expect(res.body.jurisdictionName).toBe('Općinski sud u Zagrebu')
    expect(res.body.court).not.toBeNull()
    expect(res.body.court).toHaveProperty('name')
    expect(res.body.court).toHaveProperty('slug')
    expect(res.body.court).toHaveProperty('address')
    expect(res.body.court).toHaveProperty('phone')
    expect(res.body.court).toHaveProperty('website')
  })
})

// ---------------------------------------------------------------------------
// 4f. payload.findByID throws → 200 with court: null (AC-ROUTE-019)
// ---------------------------------------------------------------------------
describe('jurisdiction route – court lookup failure (AC-ROUTE-019)', () => {
  let app: ReturnType<typeof express>
  const mockPayload = makeJurisdictionPayload()

  beforeAll(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(GEOJSON_FIXTURE)

    const router = createJurisdictionRouter(mockPayload)
    app = express()
    app.use('/api', router)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-ROUTE-019: payload.findByID throws → 200 with jurisdictionName set, court: null', async () => {
    mockPayload.findByID.mockRejectedValueOnce(new Error('Court deleted'))

    // lat=46.0, lng=16.0 is inside the fixture polygon
    const res = await request(app).get('/api/jurisdiction?lat=46.0&lng=16.0')
    expect(res.status).toBe(200)
    expect(res.body.jurisdictionName).toBe('Općinski sud u Zagrebu')
    expect(res.body.court).toBeNull()
  })
})
