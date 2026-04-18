import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCourts, getCourt } from '../courts'

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.unstubAllGlobals() })

const mockList = (docs: unknown[] = []) => ({
  docs,
  totalDocs: docs.length,
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

describe('getCourts', () => {
  it('AC-CRT-01: type maps to where[type][equals]', async () => {
    mockFetch(mockList())
    await getCourts({ type: 'municipal' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Btype%5D%5Bequals%5D=municipal')
  })

  it('AC-CRT-02: default sort is name ascending', async () => {
    mockFetch(mockList())
    await getCourts({})
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('sort=name')
  })

  it('returns validated list', async () => {
    mockFetch(mockList([{ id: '1', name: 'Općinski sud Zagreb', type: 'municipal' }]))
    const result = await getCourts({})
    expect(result.docs[0].name).toBe('Općinski sud Zagreb')
  })

  it('throws on non-2xx', async () => {
    mockFetch({ errors: [{ message: 'err' }] }, 500)
    await expect(getCourts({})).rejects.toMatchObject({ status: 500 })
  })
})

describe('getCourt', () => {
  it('AC-CRT-03: calls /api/courts/:id with locale', async () => {
    mockFetch({ id: '42', name: 'Test', type: 'municipal' })
    await getCourt('42', 'hr')
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('/api/courts/42')
    expect(url).toContain('locale=hr')
  })

  it('returns validated Court', async () => {
    mockFetch({ id: '42', name: 'Općinski sud Rijeka', type: 'municipal', phone: '051-123-456' })
    const court = await getCourt('42')
    expect(court.phone).toBe('051-123-456')
  })
})
