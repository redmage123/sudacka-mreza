import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getExpertWitnesses } from '../expert-witnesses'

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

describe('getExpertWitnesses', () => {
  it('AC-EW-01: q maps to where[_search][like]', async () => {
    mockFetch(mockList())
    await getExpertWitnesses({ q: 'Marko' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5B_search%5D%5Blike%5D=Marko')
  })

  it('AC-EW-02: speciality maps to where[speciality_areas][in]', async () => {
    mockFetch(mockList())
    await getExpertWitnesses({ speciality: 'Građevina' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bspeciality_areas%5D%5Bin%5D')
  })

  it('AC-EW-03: county maps to where[county][equals]', async () => {
    mockFetch(mockList())
    await getExpertWitnesses({ county: 'Istarska' })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('where%5Bcounty%5D%5Bequals%5D=Istarska')
  })

  it('AC-EW-04: default sort is name ascending', async () => {
    mockFetch(mockList())
    await getExpertWitnesses({})
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('sort=name')
  })

  it('AC-EW-05: default limit is 20', async () => {
    mockFetch(mockList())
    await getExpertWitnesses({})
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('limit=20')
  })

  it('returns validated list', async () => {
    mockFetch(mockList([{ id: '1', name: 'Ana Kovač', speciality_areas: ['Građevina'] }]))
    const result = await getExpertWitnesses({})
    expect(result.docs[0].name).toBe('Ana Kovač')
  })

  it('throws on non-2xx', async () => {
    mockFetch({ errors: [{ message: 'err' }] }, 500)
    await expect(getExpertWitnesses({})).rejects.toMatchObject({ status: 500 })
  })
})
