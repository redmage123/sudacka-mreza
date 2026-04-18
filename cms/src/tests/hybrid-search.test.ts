/**
 * Hybrid-search route unit tests (AC-ROUTE-020 – AC-ROUTE-026)
 *
 * Tests for cms/src/routes/hybrid-search.ts
 *
 * Isolation strategy:
 *  - Mock `pool.query` for PostgreSQL FTS calls.
 *  - Mock global `fetch` for RAG API calls.
 *  - Neither the full Payload server nor real DB/RAG is started.
 *
 * Coverage:
 *  AC-ROUTE-020  Empty q → browse (date-sorted, no FTS/RAG)
 *  AC-ROUTE-021  Non-empty q → FTS + RAG run in parallel (Promise.allSettled)
 *  AC-ROUTE-022  RRF merge — result in both lists scores higher than single-list result
 *  AC-ROUTE-023  RAG failure → graceful degradation (FTS results returned, no 500)
 *  AC-ROUTE-024  Filter params (court, courtType, decisionType, from, to) applied to browse + search paths
 *  AC-ROUTE-025  RAG-exclusive results (not in FTS pool) fetched from DB and included in response
 *  AC-ROUTE-026  FTS pool.query throws → 500 with Croatian error message
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createHybridSearchRouter } from '../routes/hybrid-search.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock payload with a controllable pool.query */
function makeMockPayload() {
  const mockPool = { query: vi.fn() }
  const mockPayload = {
    db: { pool: mockPool },
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  }
  return { mockPool, mockPayload }
}

/** Build a RAG API response body with the given titles. */
function ragResponse(titles: string[]) {
  return {
    results: titles.map((title, i) => ({ title, content: 'some content', score: 1 - i * 0.05 })),
  }
}

/** Build a minimal FTS row (matches what hybrid-search expects from PostgreSQL). */
function ftsRow(overrides: Partial<{
  id: string
  title: string
  case_number: string
  date: string
  decision_type: string
  category: string
  slug: string
  court_id: string
  court_name: string
  fts_rank: number
  excerpt: string
}> = {}) {
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'Test odluka',
    case_number: overrides.case_number ?? 'Gž-1/2024',
    date: overrides.date ?? '2024-01-01',
    decision_type: overrides.decision_type ?? 'civil',
    category: overrides.category ?? null,
    slug: overrides.slug ?? 'test-odluka',
    court_id: overrides.court_id ?? 'court-1',
    court_name: overrides.court_name ?? 'Općinski sud',
    fts_rank: overrides.fts_rank ?? 0.1,
    excerpt: overrides.excerpt ?? '<mark>Test</mark> odluka',
  }
}

// ---------------------------------------------------------------------------
// AC-ROUTE-020: Empty q → browse (no FTS/RAG overhead)
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-020: empty q → browse', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn()) // should NOT be called
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('AC-ROUTE-020: absent q → 200, searchMode=browse, fetch not called', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })   // count
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '1' }), ftsRow({ id: '2' })] }) // data

    const res = await request(app).get('/api/decisions/hybrid-search')
    expect(res.status).toBe(200)
    expect(res.body.searchMode).toBe('browse')
    expect(res.body.docs).toHaveLength(2)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('AC-ROUTE-020: empty string q → 200, searchMode=browse', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/api/decisions/hybrid-search?q=')
    expect(res.status).toBe(200)
    expect(res.body.searchMode).toBe('browse')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('AC-ROUTE-020: browse pagination reflected in response', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '50' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app).get('/api/decisions/hybrid-search?page=2&limit=10')
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(2)
    expect(res.body.limit).toBe(10)
    expect(res.body.totalPages).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-021: Non-empty q → FTS + RAG run in parallel
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-021: non-empty q → FTS + RAG parallel', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())

  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-021: q → fetch called (RAG query), pool.query called ≥2 times (FTS pool + count)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse(['[1] Test odluka']),
    }))

    mockPool.query
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '1' })] })   // FTS pool
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })         // count

    const res = await request(app).get('/api/decisions/hybrid-search?q=test')
    expect(res.status).toBe(200)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(mockPool.query.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('AC-ROUTE-021: RAG called with correct org_slug, collection_slug, query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse([]),
    })
    vi.stubGlobal('fetch', fetchMock)

    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })

    await request(app).get('/api/decisions/hybrid-search?q=imovinski+spor')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.org_slug).toBe('gigforge')
    expect(body.collection_slug).toBe('sudacka-caselaw')
    expect(body.query).toBe('imovinski spor')
    expect(body.hybrid).toBe(true)
    expect(body.rerank).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-022: RRF merge — doc in both lists has higher score than single-list docs
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-022: RRF merge scoring', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-022: doc in both FTS and RAG appears first; fts-only and rag-only appear after', async () => {
    // doc 1 — in BOTH FTS (rank 0) and RAG (rank 0)
    // doc 2 — FTS only (rank 1)
    // doc 3 — RAG only (rank 1)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse(['[1] Overlap', '[3] RAG-only']),
    }))

    mockPool.query
      .mockResolvedValueOnce({
        rows: [
          ftsRow({ id: '1', title: 'Overlap', fts_rank: 0.9 }),
          ftsRow({ id: '2', title: 'FTS-only', fts_rank: 0.5 }),
        ],
      }) // FTS pool
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })  // count
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '3', title: 'RAG-only' })] }) // rag-only DB fetch

    const res = await request(app).get('/api/decisions/hybrid-search?q=spor')
    expect(res.status).toBe(200)

    const ids = res.body.docs.map((d: { id: string }) => d.id)
    // doc 1 (overlap) should score highest → appear first
    expect(ids[0]).toBe('1')

    // doc 1 gets 'hybrid' searchMode, others get their respective mode
    const d1 = res.body.docs.find((d: { id: string }) => d.id === '1')
    expect(d1.searchMode).toBe('hybrid')
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-023: RAG failure → graceful degradation
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-023: RAG failure → FTS-only fallback', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-023: RAG fetch throws → 200 with FTS results, searchMode=keyword', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('RAG unavailable')))

    mockPool.query
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '1' })] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })

    const res = await request(app).get('/api/decisions/hybrid-search?q=test')
    expect(res.status).toBe(200)
    expect(res.body.docs).toHaveLength(1)
    expect(res.body.searchMode).toBe('keyword')
    expect(mockPayload.logger.warn).toHaveBeenCalled()
  })

  it('AC-ROUTE-023: RAG returns non-ok HTTP → 200 with FTS results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }))

    mockPool.query
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '5' })] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })

    const res = await request(app).get('/api/decisions/hybrid-search?q=imovinski')
    expect(res.status).toBe(200)
    expect(res.body.docs).toHaveLength(1)
    expect(res.body.searchMode).toBe('keyword')
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-024: Filter params applied to both browse and search paths
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-024: filter params', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-024: browse path: ?court=uuid adds cd.court_id condition', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] })

    await request(app).get('/api/decisions/hybrid-search?court=some-uuid')
    const [countSql, countParams] = mockPool.query.mock.calls[0]
    expect(countSql).toContain('cd.court_id = $')
    expect(countParams).toContain('some-uuid')
  })

  it('AC-ROUTE-024: search path: ?courtType=municipal adds c.type condition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse([]),
    }))

    mockPool.query
      .mockResolvedValueOnce({ rows: [] })  // FTS pool
      .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // count

    await request(app).get('/api/decisions/hybrid-search?q=test&courtType=municipal')

    const [ftsSql, ftsParams] = mockPool.query.mock.calls[0]
    expect(ftsSql).toContain('c.type = $')
    expect(ftsParams).toContain('municipal')
  })

  it('AC-ROUTE-024: search path: ?from and ?to add date bounds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse([]),
    }))

    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })

    await request(app).get('/api/decisions/hybrid-search?q=test&from=2024-01-01&to=2024-12-31')

    const [ftsSql, ftsParams] = mockPool.query.mock.calls[0]
    expect(ftsSql).toContain('cd.date >= $')
    expect(ftsSql).toContain('cd.date <= $')
    expect(ftsParams).toContain('2024-01-01')
    expect(ftsParams).toContain('2024-12-31')
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-025: RAG-exclusive results fetched from DB and included
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-025: RAG-exclusive results', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-025: RAG returns id not in FTS pool → extra DB fetch issued, result included', async () => {
    // RAG returns doc 99 which isn't in the FTS pool
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse(['[99] Semantic-only result']),
    }))

    mockPool.query
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '1' })] })   // FTS pool (id 1 only)
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })          // count (FTS total)
      .mockResolvedValueOnce({ rows: [ftsRow({ id: '99', title: 'Semantic-only result' })] }) // RAG-only fetch

    const res = await request(app).get('/api/decisions/hybrid-search?q=semantički')
    expect(res.status).toBe(200)

    // Both docs should be present
    const ids = res.body.docs.map((d: { id: string }) => d.id)
    expect(ids).toContain('99')

    // Doc 99 should be flagged as semantic
    const d99 = res.body.docs.find((d: { id: string }) => d.id === '99')
    expect(d99.searchMode).toBe('semantic')
  })
})

// ---------------------------------------------------------------------------
// AC-ROUTE-026: FTS pool.query throws → 500
// ---------------------------------------------------------------------------
describe('hybrid-search route — AC-ROUTE-026: FTS failure → 500', () => {
  const { mockPool, mockPayload } = makeMockPayload()
  let app: ReturnType<typeof express>

  beforeAll(() => {
    const router = createHybridSearchRouter(mockPayload)
    app = express().use('/api', router)
  })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('AC-ROUTE-026: pool.query (count) throws → 500 with Croatian error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ragResponse([]),
    }))

    // Make the count query (called after FTS pool, but if pool itself throws at top level)
    // Here: simulate pool.query always throwing
    mockPool.query.mockRejectedValue(new Error('DB unavailable'))

    const res = await request(app).get('/api/decisions/hybrid-search?q=test')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Interna pogreška servera')
    expect(mockPayload.logger.error).toHaveBeenCalled()
  })
})
