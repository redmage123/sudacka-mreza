import { ApiError, API_BASE, getAuthToken, setAuthToken } from './client'
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  email: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  totpEnabled: z.boolean().optional(),
})
export type AuthUser = z.infer<typeof UserSchema>

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

export interface LoginOutcome {
  user: AuthUser
  mustEnrolMfa?: boolean
  enrolmentToken?: string
  mfaRequired?: boolean
  mfaChallenge?: string
}

export async function login(identifier: string, password: string): Promise<LoginOutcome> {
  const trimmed = identifier.trim()
  const json = (await postJson('/users/login', { email: trimmed, password })) as {
    token?: string
    user?: AuthUser
  }
  if (json.token && json.user) {
    setAuthToken(json.token)
    return { user: json.user }
  }
  throw new ApiError(0, ['Unexpected login response'])
}

export async function verifyMfa(challenge: string, code: string): Promise<AuthUser> {
  const json = (await postJson('/users/auth/verify-mfa', { challenge, code })) as {
    token: string; user: AuthUser
  }
  setAuthToken(json.token)
  return json.user
}

export async function totpSetup(): Promise<{ secret: string; otpauth: string; qrDataUrl: string }> {
  return (await postJson('/users/me/totp/setup', {})) as { secret: string; otpauth: string; qrDataUrl: string }
}

export async function totpConfirm(code: string): Promise<{ recoveryCodes: string[] }> {
  const json = (await postJson('/users/me/totp/confirm', { code })) as { ok: boolean; recoveryCodes: string[] }
  return { recoveryCodes: json.recoveryCodes }
}

export async function totpDisable(code: string): Promise<void> {
  await postJson('/users/me/totp/disable', { code })
}

export async function totpRegenerateCodes(code: string): Promise<{ recoveryCodes: string[] }> {
  return (await postJson('/users/me/totp/regenerate-codes', { code })) as { recoveryCodes: string[] }
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
  try {
    const outcome = await login(input.email, input.password)
    return outcome.user
  } catch (err) {
    if (err instanceof ApiError) throw err
    return parsed.doc
  }
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
