#!/usr/bin/env node
/**
 * CI smoke test — authenticated endpoints.
 *
 * With the CMS running against a freshly-migrated database, register a member
 * account, log in through the real login route, and hit every authenticated
 * REST endpoint. None of them may return a 5xx.
 *
 * A missing table (collection registered but not migrated) surfaces as
 * `relation "..." does not exist` -> HTTP 500. A 200/401/403 is fine: it means
 * the table exists and the query ran — access may simply have been denied.
 * This is the integration-level counterpart to assert-schema.mjs.
 */
import { Client } from 'pg'

const PORT = process.env.PORT || '4094'
const BASE = `http://localhost:${PORT}/api`
const DATABASE_URI = process.env.DATABASE_URI

function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`)
  process.exit(1)
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/users`, { method: 'GET' })
      if (r.status > 0) return
    } catch {
      /* not listening yet */
    }
    await new Promise((res) => setTimeout(res, 2000))
  }
  throw new Error(`CMS did not come up on :${PORT} within ${timeoutMs}ms`)
}

if (!DATABASE_URI) fail('DATABASE_URI is not set')

await waitForServer()
console.log('smoke: CMS is up')

// 1. Register a member account (Users.access.create === () => true; default
//    role is "member", so the login below never triggers the admin MFA step).
const email = `ci-smoke-${Date.now()}@example.test`
const password = `Ci-${process.pid}-${Math.random().toString(36).slice(2)}-Smoke!9`
let res = await fetch(`${BASE}/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, firstName: 'CI', lastName: 'Smoke' }),
})
if (!res.ok) fail(`could not create test user (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`)
console.log('smoke: registered test member')

// 2. The Users collection requires email verification before login, which
//    can't be completed in CI (no inbox). Flip the verification flag directly
//    — this is a CI-only shortcut, not something the app ever does.
const db = new Client({ connectionString: DATABASE_URI })
await db.connect()
const upd = await db.query(
  'UPDATE users SET _verified = true, _verificationtoken = NULL WHERE email = $1',
  [email],
)
await db.end()
if (upd.rowCount !== 1) fail(`expected to verify exactly 1 user, updated ${upd.rowCount}`)
console.log('smoke: marked test member verified')

// 3. Log in via the production login route (cms/src/routes/mfa.ts). A member
//    gets { token, user } directly.
res = await fetch(`${BASE}/users/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!res.ok) fail(`login failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`)
const loginBody = await res.json()
if (loginBody.mfaRequired) fail('member login unexpectedly required MFA')
const token = loginBody.token
if (!token) fail('login returned no token')
console.log('smoke: logged in')

// 4. Every authenticated endpoint must respond without a 5xx.
const endpoints = [
  '/users/me',
  '/bookmarks?limit=1',
  '/annotations?limit=1',
  '/subscriptions?limit=1',
  '/api-keys?limit=1',
]
let failed = 0
for (const path of endpoints) {
  let status = 0
  let body = ''
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `JWT ${token}` } })
    status = r.status
    if (status >= 500) body = (await r.text()).slice(0, 300)
  } catch (e) {
    body = String(e)
  }
  const ok = status >= 200 && status < 500
  console.log(`smoke: GET ${path} -> ${status || 'ERR'} ${ok ? 'OK' : 'FAIL'}`)
  if (!ok) {
    failed++
    if (body) console.error(`  body: ${body}`)
  }
}
if (failed > 0) fail(`${failed} authenticated endpoint(s) returned 5xx or did not respond`)
console.log('smoke: PASS — all authenticated endpoints responded')
process.exit(0)
