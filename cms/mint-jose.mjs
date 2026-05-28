/**
 * Mint a Payload v3 compatible JWT for E2E auditing (bypasses the UI 2FA flow).
 *
 * Run INSIDE the cms container, where PAYLOAD_SECRET + jose are available:
 *   docker compose exec -e ROLE=admin cms node /app/mint-jose.mjs
 *
 * Payload v3 signs auth tokens with `jose` HMAC over SHA-256 using
 * PAYLOAD_SECRET as the symmetric key. The claim set is
 * { id, collection, email }. We reproduce that for an existing user.
 *
 * Outputs JUST the token to stdout so it's safe to `$(docker compose exec ...)`.
 */
import { SignJWT } from 'jose'
import pg from 'pg'

const SECRET = process.env.PAYLOAD_SECRET
const DB_URL = process.env.DATABASE_URI
const ROLE = process.env.ROLE || 'admin'
const EMAIL = process.env.EMAIL || ''
const TTL_S = parseInt(process.env.TTL_S || '7200', 10) // 2h
if (!SECRET || !DB_URL) {
  console.error('PAYLOAD_SECRET and DATABASE_URI must be set (run inside the cms container)')
  process.exit(1)
}

const client = new pg.Client({ connectionString: DB_URL })
await client.connect()
const where = EMAIL ? ['email = $1', [EMAIL]] : ['role = $1', [ROLE]]
const { rows } = await client.query(
  `SELECT id, email, role FROM users WHERE ${where[0]} ORDER BY id LIMIT 1`,
  where[1],
)
await client.end()
if (!rows.length) {
  console.error(`no user found for ${EMAIL || 'role=' + ROLE}`)
  process.exit(2)
}
const u = rows[0]

const key = new TextEncoder().encode(SECRET)
const token = await new SignJWT({ id: u.id, collection: 'users', email: u.email })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime(`${TTL_S}s`)
  .sign(key)

console.error(`minted token for user id=${u.id} email=${u.email} role=${u.role} ttl=${TTL_S}s`)
console.log(token)
