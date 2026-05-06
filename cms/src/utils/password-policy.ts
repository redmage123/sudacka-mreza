/**
 * Shared password policy used by registration, self-serve change, and admin
 * reset endpoints. Enforces:
 *   1. 12-character minimum length (NIST SP 800-63B orientation).
 *   2. HaveIBeenPwned k-anonymity check — reject any password whose SHA-1 hash
 *      has been seen in a known breach corpus.
 *
 * The HIBP call uses the range API (first 5 chars of the SHA-1 prefix), so
 * the full hash never leaves this server. On network failure we fail OPEN
 * (accept the password) rather than break enrolment — logging the error so
 * the deploy still shows up in observability.
 */
import * as crypto from 'node:crypto'

export interface PasswordPolicyResult {
  ok: boolean
  message?: string
}

const MIN_LENGTH = 12
const HIBP_URL = 'https://api.pwnedpasswords.com/range'

export async function validatePassword(password: string, logger?: { error: (o: unknown, s?: string) => void }): Promise<PasswordPolicyResult> {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, message: 'Password is required.' }
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_LENGTH} characters.` }
  }
  const breachCount = await hibpBreachCount(password, logger).catch(() => -1)
  if (breachCount > 0) {
    return {
      ok: false,
      message: 'This password has appeared in a known data breach. Choose a different one.',
    }
  }
  return { ok: true }
}

export async function hibpBreachCount(password: string, logger?: { error: (o: unknown, s?: string) => void }): Promise<number> {
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const resp = await fetch(`${HIBP_URL}/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      // 3s timeout — registration shouldn't hang if HIBP is slow.
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) {
      logger?.error({ status: resp.status }, 'HIBP range API returned non-200; failing open')
      return -1
    }
    const body = await resp.text()
    for (const line of body.split(/\r?\n/)) {
      const [hashSuffix, countStr] = line.split(':')
      if (hashSuffix?.trim().toUpperCase() === suffix) {
        const n = parseInt(countStr?.trim() ?? '0', 10)
        return Number.isFinite(n) ? n : 0
      }
    }
    return 0
  } catch (e) {
    logger?.error({ err: e }, 'HIBP check failed; failing open')
    return -1
  }
}
