import { type ZodSchema } from 'zod'

export const API_BASE = '/api'
export const AUTH_TOKEN_KEY = 'sudacka.authToken'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_TOKEN_KEY, newValue: token }))
  } catch {
    // localStorage might be disabled — fail quietly
  }
}

function buildAuthHeaders(init?: RequestInit): HeadersInit {
  const token = getAuthToken()
  const headers = new Headers(init?.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `JWT ${token}`)
  }
  return headers
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public messages: string[],
  ) {
    super(messages.join(', '))
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  schema: ZodSchema<T>,
  options?: {
    params?: Record<string, string | number | undefined>
    init?: RequestInit
  },
): Promise<T> {
  const searchParams = new URLSearchParams()
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value))
      }
    }
  }
  const qs = searchParams.toString()
  const fullPath = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  const response = await fetch(fullPath, {
    credentials: 'include',
    ...options?.init,
    headers: buildAuthHeaders(options?.init),
  })

  if (!response.ok) {
    let messages: string[] = [`HTTP ${response.status}`]
    try {
      const body = (await response.json()) as { errors?: Array<{ message: string }> }
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        messages = body.errors.map((e) => e.message)
      }
    } catch {
      // ignore parse errors on error responses
    }
    throw new ApiError(response.status, messages)
  }

  const json: unknown = await response.json()

  const result = schema.safeParse(json)
  if (!result.success) {
    throw new ApiError(0, [result.error.message])
  }

  return result.data
}
