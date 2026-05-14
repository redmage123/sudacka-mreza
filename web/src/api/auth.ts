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

const LoginSuccessSchema = z.object({
  user: UserSchema,
  token: z.string(),
  exp: z.number().optional(),
  message: z.string().optional(),
})

// MFA-aware login response: either a real success or an mfaRequired challenge
// from the email-OTP flow (cms/src/routes/mfa.ts).
const LoginMfaSchema = z.object({
  mfaRequired: z.literal(true),
  challenge: z.string(),
  channel: z.string().optional(),
  emailHint: z.string().optional(),
})

const VerifyMfaResponseSchema = LoginSuccessSchema

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

export type LoginResult =
  | { kind: 'success'; user: AuthUser }
  | { kind: 'mfa'; challenge: string; channel: string; emailHint: string }

// MFA-aware login. Routes through the custom /api/users/auth/login endpoint
// (cms/src/routes/mfa.ts). For non-admins, the server returns the token
// directly; for admins, it returns { mfaRequired, challenge, emailHint } and
// the caller must follow up with verifyMfa(challenge, code).
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const trimmed = identifier.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  const payload = isEmail
    ? { email: trimmed, password }
    : { username: trimmed, password }
  const json = await postJson('/users/auth/login', payload)

  // Try MFA challenge first (cheap discriminator on `mfaRequired`).
  const mfa = LoginMfaSchema.safeParse(json)
  if (mfa.success) {
    return {
      kind: 'mfa',
      challenge: mfa.data.challenge,
      channel: mfa.data.channel ?? 'email',
      emailHint: mfa.data.emailHint ?? '',
    }
  }
  const parsed = LoginSuccessSchema.parse(json)
  setAuthToken(parsed.token)
  return { kind: 'success', user: parsed.user }
}

export async function verifyMfa(challenge: string, code: string): Promise<AuthUser> {
  const json = await postJson('/users/auth/verify-mfa', { challenge, code: code.trim() })
  const parsed = VerifyMfaResponseSchema.parse(json)
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
  // Members never trigger MFA, so .kind === 'success' is guaranteed for
  // self-registered accounts.
  try {
    const result = await login(input.email, input.password)
    if (result.kind === 'success') return result.user
    // Defensive: if a registered account somehow gets MFA, fall back to the
    // unauthenticated record so the caller can route to the MFA UI.
    return parsed.doc
  } catch (err) {
    if (err instanceof ApiError) throw err
    return parsed.doc
  }
}

// Request a password-reset email. The server always responds 200 (it never
// reveals whether the address is registered), so this resolves either way.
export async function requestPasswordReset(email: string, lang: string): Promise<void> {
  await postJson('/users/auth/forgot-password', { email: email.trim(), lang })
}

// Consume a reset token (from the emailed link) and set a new password.
// Throws ApiError if the token is invalid or expired.
export async function resetPassword(token: string, password: string): Promise<void> {
  await postJson('/users/auth/reset-password', { token, password })
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
