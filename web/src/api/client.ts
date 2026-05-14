import { type ZodSchema } from 'zod'

export const API_BASE = '/api'
export const AUTH_TOKEN_KEY = 'sudacka.authToken'
// Custom event fired on the current tab whenever the auth token is set or cleared.
// We can't rely on the native `storage` event for same-tab notifications since
// the spec only fires it on other windows that share the storage area.
export const AUTH_TOKEN_EVENT = 'sudacka:authTokenChanged'

// In-memory mirror of the auth token. localStorage is the source of truth for
// cross-tab persistence, but it can throw or be unavailable (private-mode
// quirks, "block site data" privacy settings, Safari ITP, full quota, embedded
// webviews). When that happens we must NOT silently drop the token — that
// leaves the user authenticated in the API's eyes but logged-out in the UI:
// they pass login/MFA, then the very next request sends no Authorization
// header and bounces them back to the login screen. The in-memory copy keeps
// the current tab's session working even when persistence fails.
let inMemoryToken: string | null = null
let storageWorks = true

export function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY)
    // localStorage wins when present; otherwise fall back to the memory mirror.
    return stored ?? inMemoryToken
  } catch {
    return inMemoryToken
  }
}

export function setAuthToken(token: string | null): void {
  // Always update the in-memory mirror first — this is the part that cannot fail.
  inMemoryToken = token
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
    storageWorks = true
  } catch (err) {
    // Persistence failed — the session still works for this tab via the memory
    // mirror, but it won't survive a reload or reach other tabs. Surface it
    // once instead of swallowing it, so it's diagnosable.
    if (storageWorks) {
      storageWorks = false
      console.error(
        '[auth] localStorage is unavailable — session will not persist across reloads/tabs.',
        err,
      )
    }
  }
  // Always dispatch — useAuth in the same tab needs to know.
  try {
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT, { detail: { token } }))
  } catch {
    /* SSR / no window */
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
