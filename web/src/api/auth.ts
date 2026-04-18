import { ApiError, API_BASE, getAuthToken, setAuthToken } from './client'
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  email: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
})
export type AuthUser = z.infer<typeof UserSchema>

const LoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
  exp: z.number().optional(),
  message: z.string().optional(),
})

const RegisterResponseSchema = z.object({
  doc: UserSchema,
  message: z.string().optional(),
})

const MeResponseSchema = z.object({
  user: UserSchema.nullable(),
  token: z.string().optional(),
})

async function postJson(path: string, body: unknown): Promise<unknown> {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `JWT ${token}`

  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    let messages: string[] = [`HTTP ${resp.status}`]
    try {
      const parsed = (await resp.json()) as { errors?: Array<{ message: string }> }
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        messages = parsed.errors.map((e) => e.message)
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(resp.status, messages)
  }

  return resp.json()
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  // Accept either an email address or a short username. Payload's Users
  // collection has `loginWithUsername` enabled with `allowEmailLogin: true`,
  // so we route based on whether the input looks like an email.
  const trimmed = identifier.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  const payload = isEmail
    ? { email: trimmed, password }
    : { username: trimmed, password }
  const json = await postJson('/users/login', payload)
  const parsed = LoginResponseSchema.parse(json)
  setAuthToken(parsed.token)
  return parsed.user
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  profile?: { organisation?: string; phone?: string }
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const json = await postJson('/users', input)
  const parsed = RegisterResponseSchema.parse(json)
  // Immediately attempt to log in; auto-verify hook means this will work.
  return login(input.email, input.password).catch((err) => {
    // Fall back to returning the created doc without a token if auto-login
    // fails for any reason (e.g. verify still required in prod).
    if (err instanceof ApiError) throw err
    return parsed.doc
  })
}

export async function logout(): Promise<void> {
  const token = getAuthToken()
  if (token) {
    try {
      await postJson('/users/logout', {})
    } catch {
      // Ignore server-side logout errors — we still clear the local token.
    }
  }
  setAuthToken(null)
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getAuthToken()
  if (!token) return null
  try {
    const resp = await fetch(`${API_BASE}/users/me`, {
      credentials: 'include',
      headers: { Authorization: `JWT ${token}` },
    })
    if (!resp.ok) {
      if (resp.status === 401) setAuthToken(null)
      return null
    }
    const json = await resp.json()
    const parsed = MeResponseSchema.parse(json)
    return parsed.user
  } catch {
    return null
  }
}
