/**
 * Mint a Payload-compatible JWT for E2E auditing (bypasses the UI 2FA flow).
 * Run INSIDE the cms container, where PAYLOAD_SECRET + the DB are reachable:
 *
 *   docker compose exec -e ROLE=admin cms node /app/scripts/mint-user-token.mjs
 *   # or: ROLE=editor / a specific EMAIL=...
 *
 * Prints the token to stdout. Use it as E2E_ADMIN_TOKEN / E2E_EDITOR_TOKEN.
 *
 * Payload v3 signs the auth JWT with PAYLOAD_SECRET (HS256) over a claim set of
 * { id, collection, email }. We reproduce that for an existing user so the token
 * verifies server-side without touching 2FA.
 */
import jwt from 'jsonwebtoken'
import pg from 'pg'

const SECRET = process.env.PAYLOAD_SECRET
const DB_URL = process.env.DATABASE_URI
const ROLE = process.env.ROLE || 'admin'
const EMAIL = process.env.EMAIL || ''
if (!SECRET || !DB_URL) {
  console.error('PAYLOAD_SECRET and DATABASE_URI must be set (run inside the cms container)')
  process.exit(1)
}

const client = new pg.Client({ connectionString: DB_URL })
await client.connect()
const where = EMAIL ? ['email = $1', [EMAIL]] : ['role = $1', [ROLE]]
const { rows } = await client.query(
  `SELECT id, email, role FROM users WHERE ${where[0]} ORDER BY id LIMIT 1`, where[1])
await client.end()
if (!rows.length) {
  console.error(`no user found for ${EMAIL || 'role=' + ROLE}`)
  process.exit(2)
}
const u = rows[0]
const token = jwt.sign(
  { id: u.id, collection: 'users', email: u.email },
  SECRET,
  { expiresIn: '2h' },
)
console.error(`minted token for user id=${u.id} email=${u.email} role=${u.role}`)
console.log(token)
