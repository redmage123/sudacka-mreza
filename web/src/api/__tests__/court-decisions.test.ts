import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchDecisions, getCourts_forFilter } from '../court-decisions'

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.unstubAllGlobals() })

const mockList = (docs: unknown[] = [], totalDocs = 0) => ({
  docs,
  totalDocs,
  limit: 20,
  totalPages: 1,
  page: 1,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
})

function mockFetch(body: unknown, status = 200) {
  ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  )
}

describe('searchDecisions', () => {
  it('AC-CD-01: calls /api/court-decisions with sort=-date&limit=20&locale=hr', async () => {
    mockFetch(mockList())
    await searchDecisions({})
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('/api/court-decisions')
    expect(url).toContain('sort=-date')
    expect(url).toContain('limit=20')
    expect(url).toContain('locale=hr')
  })

  it('AC-CD-02: q maps to where[_search][like]', async () => {
    mockFetch(mockList())
    await searchDecisions({ q: 'nekretnina' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5B_search%5D%5Blike%5D=nekretnina')
  })

  it('AC-CD-03: court maps to where[court][equals]', async () => {
    mockFetch(mockList())
    await searchDecisions({ court: 'VTS Zagreb' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bcourt%5D%5Bequals%5D=VTS+Zagreb')
  })

  it('AC-CD-04: from maps to where[date][greater_than]', async () => {
    mockFetch(mockList())
    await searchDecisions({ from: '2024-01-01' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bdate%5D%5Bgreater_than%5D=2024-01-01')
  })

  it('AC-CD-05: to maps to where[date][less_than]', async () => {
    mockFetch(mockList())
    await searchDecisions({ to: '2024-12-31' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bdate%5D%5Bless_than%5D=2024-12-31')
  })

  it('AC-CD-06: type maps to where[decision_type][equals]', async () => {
    mockFetch(mockList())
    await searchDecisions({ type: 'VTS' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bdecision_type%5D%5Bequals%5D=VTS')
  })

  it('AC-CD-07: undefined params are not included', async () => {
    mockFetch(mockList())
    await searchDecisions({ q: undefined, court: undefined })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).not.toContain('_search')
    expect(url).not.toContain('court%5D%5Bequals%5D')
  })

  it('AC-CD-08: returns validated PayloadList', async () => {
    mockFetch(mockList([{ id: '1', title: 'T', court: 'C', date: '2024-01-01', decision_type: 'VTS' }], 1))
    const result = await searchDecisions({})
    expect(result.docs[0].id).toBe('1')
    expect(result.totalDocs).toBe(1)
  })

  it('throws ApiError on non-2xx', async () => {
    mockFetch({ errors: [{ message: 'Server Error' }] }, 500)
    await expect(searchDecisions({})).rejects.toMatchObject({ status: 500 })
  })

  it('throws ApiError on Zod failure', async () => {
    mockFetch({ docs: [{ invalid: true }], totalDocs: 1, limit: 20, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null })
    // docs[0] will fail schema — but list schema validates docs array items
    // a doc without id/title/court/date/decision_type should fail
    await expect(searchDecisions({})).rejects.toMatchObject({ status: 0 })
  })
})

describe('getCourts_forFilter', () => {
  it('AC-CD-09: returns deduplicated sorted court name strings', async () => {
    mockFetch({
      docs: [
        { id: '2', name: 'Trgovački sud Zagreb', type: 'commercial' },
        { id: '1', name: 'Općinski sud Zagreb', type: 'municipal' },
        { id: '3', name: 'Općinski sud Zagreb', type: 'municipal' },
      ],
      totalDocs: 3, limit: 100, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null,
    })
    const names = await getCourts_forFilter('hr')
    expect(names).toEqual(['Općinski sud Zagreb', 'Trgovački sud Zagreb'])
    expect(names.length).toBe(2) // deduplicated
  })
})
