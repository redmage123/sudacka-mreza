/**
 * Two-factor authentication — email OTP for admins.
 *
 *   POST /api/users/auth/login
 *     Body:    { email | username, password }
 *     Admin:   → { mfaRequired: true, challenge }
 *              The server generates a 6-digit code, stores its SHA-256 hash
 *              with a 10-minute expiry and a 5-attempt cap, emails the plain
 *              code to the user's registered email, and returns a short-lived
 *              HMAC-signed challenge that carries the real Payload session
 *              token internally.
 *     Member:  → { token, user }  — non-admins have no 2FA.
 *
 *   POST /api/users/auth/verify-mfa
 *     Body:    { challenge, code }
 *     Success: → { token, user }  — the Payload token stashed in the challenge.
 *     Failure: attempts counter increments; >=5 burns the OTP.
 *
 * Legacy TOTP endpoints (/users/me/totp/*) are retained but unused; they
 * will be removed in a follow-up once all admins have converted.
 */
import { Router, type Request, type Response } from 'express'
import type { Payload } from 'payload'
import * as crypto from 'node:crypto'
import { sendMail } from '../utils/mail.js'

interface AuthRequest extends Request {
  user?: { id: number | string; role?: string; email?: string }
}

function signingKey(): string {
  const raw = process.env.PAYLOAD_SECRET ?? ''
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}
function hmac(parts: string): string {
  return crypto.createHmac('sha256', signingKey()).update(parts).digest('base64url')
}

function signChallenge(data: Record<string, unknown>, ttlSeconds: number): string {
  const hdr = b64url(JSON.stringify({ alg: 'HS256', typ: 'MFA' }))
  const body = b64url(JSON.stringify({
    ...data,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    iat: Math.floor(Date.now() / 1000),
  }))
  return `${hdr}.${body}.${hmac(`${hdr}.${body}`)}`
}

function verifyChallenge(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  if (hmac(`${h}.${b}`) !== s) return null
  try {
    const decoded = JSON.parse(Buffer.from(b, 'base64url').toString('utf-8'))
    if (typeof decoded.exp === 'number' && decoded.exp * 1000 < Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

async function verifyPayloadJwt(token: string): Promise<{ id: number | string; collection: string } | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, b, s] = parts
  const key = signingKey()
  const expected = crypto.createHmac('sha256', key).update(`${h}.${b}`).digest('base64url')
  if (expected !== s) return null
  try {
    const decoded = JSON.parse(Buffer.from(b, 'base64url').toString('utf-8')) as {
      id: number | string; collection: string; exp?: number
    }
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex')
}

function generateOtp(): string {
  // 6 digits, zero-padded. crypto.randomInt is uniform across [0, 1_000_000).
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

const OTP_TTL_SECONDS = 600             // 10 minutes
const OTP_MAX_ATTEMPTS = 5

async function storeOtp(payload: Payload, userId: number | string, code: string): Promise<void> {
  const pg = (payload.db as { pool: { query: (sql: string, params: unknown[]) => Promise<unknown> } }).pool
  const expires = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString()
  await pg.query(
    `UPDATE users
        SET email_otp_hash = $1,
            email_otp_expires_at = $2,
            email_otp_attempts = 0
      WHERE id = $3`,
    [hashOtp(code), expires, userId],
  )
}

async function clearOtp(payload: Payload, userId: number | string): Promise<void> {
  const pg = (payload.db as { pool: { query: (sql: string, params: unknown[]) => Promise<unknown> } }).pool
  await pg.query(
    `UPDATE users
        SET email_otp_hash = NULL,
            email_otp_expires_at = NULL,
            email_otp_attempts = 0
      WHERE id = $1`,
    [userId],
  )
}

async function incrementOtpAttempts(payload: Payload, userId: number | string): Promise<number> {
  const pg = (payload.db as {
    pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ email_otp_attempts: number }> }> }
  }).pool
  const result = await pg.query(
    `UPDATE users
        SET email_otp_attempts = COALESCE(email_otp_attempts, 0) + 1
      WHERE id = $1
      RETURNING email_otp_attempts`,
    [userId],
  )
  return result.rows[0]?.email_otp_attempts ?? 0
}

export function createMfaRouter(payload: Payload): Router {
  const router = Router()

  // Attach req.user from Authorization: JWT <token> for legacy endpoints.
  router.use(async (req: AuthRequest, _res, next) => {
    try {
      const auth = req.headers.authorization
      if (auth?.startsWith('JWT ')) {
        const decoded = await verifyPayloadJwt(auth.slice(4))
        if (decoded?.collection === 'users' && decoded.id) {
          const doc = await payload.findByID({
            collection: 'users', id: decoded.id, overrideAccess: true, depth: 0,
          })
          if (doc) req.user = {
            id: doc.id as number | string,
            role: (doc as { role?: string }).role,
            email: (doc as { email?: string }).email,
          }
        }
      }
    } catch { /* unauthenticated — fall through */ }
    next()
  })

  // ── Two-step login ────────────────────────────────────────────────────────
  router.post('/users/auth/login', async (req: AuthRequest, res) => {
    const { email, username, password } = (req.body ?? {}) as {
      email?: string; username?: string; password?: string
    }
    if (!password || (!email && !username)) {
      return res.status(400).json({ errors: [{ message: 'email or username + password required' }] })
    }

    // Delegate credential verification to Payload's own login endpoint so we
    // keep lockout, verify-email, and session tracking semantics.
    let loginResp: Record<string, unknown>
    try {
      const resp = await fetch(
        `http://localhost:${process.env.PORT ?? '4094'}/api/users/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password }),
        },
      )
      loginResp = await resp.json()
      if (!resp.ok) {
        return res.status(resp.status).json(loginResp)
      }
    } catch (e) {
      payload.logger.error({ err: e }, 'step1 login relay failed')
      return res.status(500).json({ errors: [{ message: 'Login service unavailable' }] })
    }

    const user = (loginResp as { user?: { id: number | string; role?: string; email?: string } }).user
    const token = (loginResp as { token?: string }).token
    if (!user || !token) {
      return res.status(500).json({ errors: [{ message: 'Login response malformed' }] })
    }

    const full = await payload.findByID({
      collection: 'users', id: user.id, overrideAccess: true, depth: 0,
    })
    const role = (full as { role?: string }).role
    const userEmail = (full as { email?: string }).email

    // Non-admins: no 2FA. Issue the session token directly.
    if (role !== 'admin') {
      return res.json({
        token,
        user: { ...user, role, totpEnabled: false },
      })
    }

    // Admin: generate OTP, store its hash, email the plain code, return a
    // challenge holding the real session token.
    if (!userEmail) {
      return res.status(500).json({ errors: [{ message: 'Admin account has no email on file; cannot issue 2FA code.' }] })
    }
    const code = generateOtp()
    try {
      await storeOtp(payload, user.id, code)
    } catch (e) {
      payload.logger.error({ err: e }, 'failed to store email OTP')
      return res.status(500).json({ errors: [{ message: 'Could not issue 2FA code.' }] })
    }
    let deliveredVia: 'resend' | 'msmtp' | 'console'
    try {
      deliveredVia = await sendMail(payload, {
        to: userEmail,
        subject: 'Sudačka Mreža — prijavni kod',
        text:
          `Vaš jednokratni prijavni kod je: ${code}\n\n` +
          `Kod vrijedi 10 minuta i može se iskoristiti samo jednom. ` +
          `Ako niste pokušali prijavu, zanemarite ovu poruku i odmah promijenite lozinku.\n\n` +
          `Your one-time login code is: ${code}\n\n` +
          `This code is valid for 10 minutes and single-use. If you did not attempt to log in, ignore this message and change your password immediately.\n`,
      })
    } catch (e) {
      payload.logger.error({ err: e }, 'email OTP delivery failed')
      return res.status(500).json({ errors: [{ message: 'Could not send 2FA code to your email.' }] })
    }
    // sendMail() never throws — with no real transport it falls through to a
    // console-log fallback. In production that means the code was never
    // actually delivered, so fail loudly instead of handing back a challenge
    // the user can never satisfy. Non-prod keeps the fallback so developers
    // can read the code from the log.
    if (deliveredVia === 'console' && process.env.NODE_ENV === 'production') {
      payload.logger.error(
        { userId: user.id },
        'OTP fell through to console fallback — no mail transport configured in production',
      )
      await clearOtp(payload, user.id)
      return res.status(500).json({ errors: [{ message: 'Could not send 2FA code to your email.' }] })
    }

    // The challenge must live at least as long as the OTP it wraps — the
    // client submits both together on verify-mfa. Keep it equal to
    // OTP_TTL_SECONDS so it matches the 10-minute validity stated in the email.
    const challenge = signChallenge(
      { sub: user.id, email: userEmail, kind: 'mfa-pending', pendingToken: token, channel: 'email' },
      OTP_TTL_SECONDS,
    )
    return res.json({
      mfaRequired: true,
      challenge,
      channel: 'email',
      // Hint the frontend can display without leaking the full address.
      emailHint: maskEmail(userEmail),
    })
  })

  // ── Verify MFA — email OTP ─────────────────────────────────────────────
  router.post('/users/auth/verify-mfa', async (req, res) => {
    const { challenge, code } = (req.body ?? {}) as { challenge?: string; code?: string }
    if (!challenge || !code) {
      return res.status(400).json({ errors: [{ message: 'challenge + code required' }] })
    }
    const payloadJwt = verifyChallenge(challenge)
    if (!payloadJwt || payloadJwt.kind !== 'mfa-pending') {
      return res.status(400).json({ errors: [{ message: 'Invalid or expired challenge' }] })
    }
    const userId = payloadJwt.sub as number | string
    const doc = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, depth: 0 })
    if (!doc) return res.status(404).json({ errors: [{ message: 'User not found' }] })

    const storedHash = (doc as { emailOtpHash?: string | null }).emailOtpHash
    const expiresAt = (doc as { emailOtpExpiresAt?: string | null }).emailOtpExpiresAt
    const attempts = (doc as { emailOtpAttempts?: number | null }).emailOtpAttempts ?? 0

    if (!storedHash || !expiresAt) {
      return res.status(400).json({ errors: [{ message: 'No active 2FA code. Request a new login.' }] })
    }
    if (new Date(expiresAt).getTime() < Date.now()) {
      await clearOtp(payload, userId)
      return res.status(400).json({ errors: [{ message: 'Code expired. Request a new login.' }] })
    }
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await clearOtp(payload, userId)
      return res.status(429).json({ errors: [{ message: 'Too many attempts. Request a new login.' }] })
    }

    const provided = code.replace(/\s+/g, '')
    if (hashOtp(provided) !== storedHash) {
      const next = await incrementOtpAttempts(payload, userId)
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - next)
      return res.status(400).json({
        errors: [{ message: `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }],
      })
    }

    // Success — burn the OTP, release the token.
    await clearOtp(payload, userId)
    const pendingToken = (payloadJwt as { pendingToken?: string }).pendingToken
    if (typeof pendingToken !== 'string' || pendingToken.length === 0) {
      return res.status(500).json({ errors: [{ message: 'Challenge missing embedded session token.' }] })
    }
    return res.json({
      token: pendingToken,
      user: {
        id: userId,
        email: (doc as { email?: string }).email,
        role: (doc as { role?: string }).role,
        firstName: (doc as { firstName?: string }).firstName,
        lastName: (doc as { lastName?: string }).lastName,
        username: (doc as { username?: string }).username,
      },
    })
  })

  // ── Forgot password — request a reset link ─────────────────────────────
  // Payload has no email adapter configured, so its built-in forgot-password
  // would only console-log the mail. We generate the token via the Local API
  // with disableEmail and send the link ourselves through the msmtp transport.
  router.post('/users/auth/forgot-password', async (req, res) => {
    const { email, lang } = (req.body ?? {}) as { email?: string; lang?: string }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ errors: [{ message: 'email is required' }] })
    }
    // Anti-enumeration: always answer 200, regardless of whether the address
    // exists or the mail send succeeds.
    const respondOk = () => res.json({ ok: true })

    let token: string
    try {
      token = (await payload.forgotPassword({
        collection: 'users',
        data: { email: email.trim().toLowerCase() },
        disableEmail: true,
      })) as string
    } catch {
      return respondOk()
    }
    if (typeof token !== 'string' || token.length === 0) return respondOk()

    // Build the reset URL from the REQUEST host — never from a client-supplied
    // value (that would be a phishing vector). lang is only a path segment.
    const safeLang = /^[a-z]{2}$/.test(String(lang)) ? String(lang) : 'hr'
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').replace(
      /[^a-zA-Z0-9.:-]/g,
      '',
    )
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
    const link = `${proto}://${host}/${safeLang}/prijava/nova-lozinka?token=${encodeURIComponent(token)}`

    try {
      await sendMail(payload, {
        to: email.trim(),
        subject: 'Sudačka Mreža — ponovno postavljanje lozinke',
        text:
          'Zatražili ste ponovno postavljanje lozinke za Sudačku Mrežu.\n\n' +
          `Otvorite ovu poveznicu da postavite novu lozinku (vrijedi 1 sat):\n${link}\n\n` +
          'Ako niste zatražili ovu promjenu, zanemarite ovu poruku.\n\n' +
          '--\n\n' +
          'You requested a password reset for Sudačka Mreža.\n\n' +
          `Open this link to set a new password (valid for 1 hour):\n${link}\n\n` +
          'If you did not request this, ignore this message.\n',
      })
    } catch (e) {
      payload.logger.error({ err: e }, 'failed to send password-reset email')
    }
    return respondOk()
  })

  // ── Reset password — consume the token, set a new password ─────────────
  router.post('/users/auth/reset-password', async (req, res) => {
    const { token, password } = (req.body ?? {}) as { token?: string; password?: string }
    if (!token || !password) {
      return res.status(400).json({ errors: [{ message: 'token and password are required' }] })
    }
    if (password.length < 8) {
      return res.status(400).json({ errors: [{ message: 'Password must be at least 8 characters.' }] })
    }
    try {
      await payload.resetPassword({
        collection: 'users',
        data: { token, password },
        overrideAccess: true,
      })
    } catch {
      return res.status(400).json({ errors: [{ message: 'This reset link is invalid or has expired.' }] })
    }
    return res.json({ ok: true })
  })

  return router
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`
}
