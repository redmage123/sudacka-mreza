import { type ZodSchema } from 'zod'

export const API_BASE = '/api'
export const AUTH_TOKEN_KEY = 'sudacka.authToken'
// Custom event fired on the current tab whenever the auth token is set or cleared.
// We can't rely on the native `storage` event for same-tab notifications since
// the spec only fires it on other windows that share the storage area.
export const AUTH_TOKEN_EVENT = 'sudacka:authTokenChanged'

// The auth token is persisted through three layers, most-durable first:
//
//   1. localStorage          — survives reloads, shared across tabs (normal case)
//   2. a client-managed cookie — survives reloads even when localStorage is
//      blocked. Safari Private Browsing, iOS low-storage, and "block site data"
//      make localStorage.setItem THROW, but cookies are a separate mechanism
//      that still works in those modes. This is why a login could succeed and
//      then immediately bounce the user back to the login screen: the token
//      had nowhere durable to live.
//   3. in-memory mirror      — last resort, lives only for the current page load
//
// The token is ALWAYS sent to the API as an `Authorization: JWT` header (never
// relied on as a cookie server-side), so this cookie is purely a client-side
// persistence mirror and is intentionally NOT httpOnly — the client must read
// it back. Payload ignores it (it looks for its own `payload-token` cookie).
const AUTH_COOKIE_KEY = 'sudacka_auth'
const AUTH_COOKIE_MAX_AGE = 7200 // seconds — matches Payload's default token lifetime

let inMemoryToken: string | null = null
let warnedNoPersistence = false

function readLocalStorageToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeLocalStorageToken(token: string | null): boolean {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
    return true
  } catch {
    // setItem can throw (quota / private mode) while removeItem usually does
    // not. Clear the key so a STALE value can't shadow the cookie/memory copy.
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    } catch {
      /* ignore — nothing we can do */
    }
    return false
  }
}

function readCookieToken(): string | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)sudacka_auth=([^;]*)/)
    return match ? decodeURIComponent(match[1]) || null : null
  } catch {
    return null
  }
}

function writeCookieToken(token: string | null): boolean {
  try {
    document.cookie = token
      ? `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`
      : `${AUTH_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`
    return true
  } catch {
    return false
  }
}

export function getAuthToken(): string | null {
  // localStorage first so a logout/login in another tab is honored; then the
  // cookie (survives reload when localStorage is blocked); then the in-memory
  // mirror (current page load only).
  return readLocalStorageToken() ?? readCookieToken() ?? inMemoryToken
}

export function setAuthToken(token: string | null): void {
  // In-memory mirror first — this layer cannot fail.
  inMemoryToken = token
  const lsOk = writeLocalStorageToken(token)
  const cookieOk = writeCookieToken(token)
  // Only a real problem if NOTHING durable accepted the write: the session
  // then works for this page load only and won't survive a reload.
  if (token && !lsOk && !cookieOk && !warnedNoPersistence) {
    warnedNoPersistence = true
    console.error('[auth] no persistent storage available — session will not survive a reload.')
  } else if (lsOk || cookieOk) {
    warnedNoPersistence = false
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
