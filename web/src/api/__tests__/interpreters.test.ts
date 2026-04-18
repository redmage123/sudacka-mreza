import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getInterpreters } from '../interpreters'

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

describe('getInterpreters', () => {
  it('AC-INT-01: languagePair maps to where[language_pairs][in]', async () => {
    mockFetch(mockList())
    await getInterpreters({ languagePair: 'HR-EN' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Blanguage_pairs%5D%5Bin%5D=HR-EN')
  })

  it('AC-INT-02: default sort is name ascending', async () => {
    mockFetch(mockList())
    await getInterpreters({})
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('sort=name')
  })

  it('returns validated list', async () => {
    mockFetch(mockList([{ id: '1', name: 'Ivan Perić', language_pairs: ['HR-EN', 'HR-DE'] }]))
    const result = await getInterpreters({})
    expect(result.docs[0].language_pairs).toContain('HR-EN')
  })

  it('throws on non-2xx', async () => {
    mockFetch({ errors: [{ message: 'err' }] }, 500)
    await expect(getInterpreters({})).rejects.toMatchObject({ status: 500 })
  })

  it('throws on Zod failure', async () => {
    mockFetch({ docs: [{ id: 1 }], totalDocs: 1, limit: 20, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null })
    await expect(getInterpreters({})).rejects.toMatchObject({ status: 0 })
  })
})
