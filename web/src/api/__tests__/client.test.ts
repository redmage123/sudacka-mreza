import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { apiFetch, ApiError, API_BASE } from '../client'

const schema = z.object({ id: z.string(), name: z.string() })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(body: unknown, status = 200) {
  ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  )
}

describe('API_BASE', () => {
  it('is /api', () => {
    expect(API_BASE).toBe('/api')
  })
})

describe('apiFetch', () => {
  it('AC-CLIENT-01: builds correct URL with encoded query params', async () => {
    mockFetch({ id: '1', name: 'Test' })
    await apiFetch('/things', schema, { params: { q: 'hello world', page: 2 } })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('q=hello+world')
    expect(url).toContain('page=2')
  })

  it('AC-CLIENT-02: undefined params are omitted', async () => {
    mockFetch({ id: '1', name: 'Test' })
    await apiFetch('/things', schema, { params: { q: undefined, page: 1 } })
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).not.toContain('q=')
    expect(url).toContain('page=1')
  })

  it('AC-CLIENT-03: non-2xx throws ApiError with status', async () => {
    mockFetch({ errors: [{ message: 'Not Found' }] }, 404)
    await expect(apiFetch('/things', schema)).rejects.toMatchObject({
      status: 404,
      messages: ['Not Found'],
    })
  })

  it('AC-CLIENT-04: Payload error envelope is correctly parsed', async () => {
    mockFetch({ errors: [{ message: 'Unauthorized' }, { message: 'Token expired' }] }, 401)
    try {
      await apiFetch('/things', schema)
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).messages).toEqual(['Unauthorized', 'Token expired'])
    }
  })

  it('AC-CLIENT-05: Zod failure throws ApiError with status=0', async () => {
    mockFetch({ id: 123, name: 'wrong type' }) // id should be string
    await expect(apiFetch('/things', schema)).rejects.toMatchObject({ status: 0 })
  })

  it('AC-CLIENT-06: credentials: include is set on every request', async () => {
    mockFetch({ id: '1', name: 'Test' })
    await apiFetch('/things', schema)
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init).toMatchObject({ credentials: 'include' })
  })

  it('AC-CLIENT-07: return type is inferred from schema', async () => {
    mockFetch({ id: '1', name: 'Test' })
    const result = await apiFetch('/things', schema)
    // TypeScript check: result.id and result.name should exist
    expect(result.id).toBe('1')
    expect(result.name).toBe('Test')
  })
})
