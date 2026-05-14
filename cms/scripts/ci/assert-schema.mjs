#!/usr/bin/env node
/**
 * CI guard — schema completeness.
 *
 * After `payload migrate` has run against a clean database, every collection
 * registered in payload.config.ts must have a real table.
 *
 * This catches the class of bug where a collection is added to the config but
 * no migration is generated for it. It is invisible in development because the
 * Postgres adapter runs in "push" mode there and auto-creates tables from the
 * collection configs — but in production, which runs migrations only, the
 * table is simply missing and every request to that collection 500s with
 * `relation "..." does not exist`.
 *
 * See migration 20260514_080000_user_action_collections for the incident this
 * guards against (subscriptions / annotations / bookmarks / api_keys).
 */
import { Client } from 'pg'
import configPromise from '../../dist/payload.config.js'

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  console.error('assert-schema: DATABASE_URI is not set')
  process.exit(2)
}

const config = await configPromise
const collections = config.collections ?? []
if (collections.length === 0) {
  console.error('assert-schema: config exposed no collections — build may be stale')
  process.exit(2)
}

const client = new Client({ connectionString: DATABASE_URI })
await client.connect()
const { rows } = await client.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
)
await client.end()

const tables = new Set(rows.map((r) => r.tablename))
// Payload derives the Postgres table name from the collection slug by
// replacing hyphens with underscores (e.g. "api-keys" -> "api_keys").
const missing = collections
  .map((c) => ({ slug: c.slug, table: String(c.slug).replaceAll('-', '_') }))
  .filter((c) => !tables.has(c.table))

if (missing.length > 0) {
  console.error(
    `assert-schema: ${missing.length} registered collection(s) have no table after migrate:\n` +
      missing.map((c) => `  - ${c.slug}  (expected table "${c.table}")`).join('\n') +
      '\n\nGenerate a migration for them:  cd cms && npx payload migrate:create <name>',
  )
  process.exit(1)
}

console.log(`assert-schema: OK — all ${collections.length} collections have a table`)
process.exit(0)
