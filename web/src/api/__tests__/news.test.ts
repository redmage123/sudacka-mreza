import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getNewsPosts } from '../news'

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.unstubAllGlobals() })

const mockList = (docs: unknown[] = []) => ({
  docs,
  totalDocs: docs.length,
  limit: 5,
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

describe('getNewsPosts', () => {
  it('AC-NEWS-01: default sort is -published_at', async () => {
    mockFetch(mockList())
    await getNewsPosts()
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('sort=-published_at')
  })

  it('AC-NEWS-02: default limit is 5', async () => {
    mockFetch(mockList())
    await getNewsPosts()
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('limit=5')
  })

  it('respects custom limit', async () => {
    mockFetch(mockList())
    await getNewsPosts({ limit: 10 })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('limit=10')
  })

  it('returns validated list', async () => {
    mockFetch(mockList([{ id: '1', title: 'Vijest 1', slug: 'vijest-1', published_at: '2024-01-15' }]))
    const result = await getNewsPosts()
    expect(result.docs[0].slug).toBe('vijest-1')
  })

  it('throws on non-2xx', async () => {
    mockFetch({ errors: [{ message: 'err' }] }, 500)
    await expect(getNewsPosts()).rejects.toMatchObject({ status: 500 })
  })
})
