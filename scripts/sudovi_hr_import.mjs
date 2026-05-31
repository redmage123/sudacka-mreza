// Load /tmp/sudovi-courts.jsonl into the courts table. For each scraped
// record, match by exact court name first, then by stripped-name (fold
// diacritics + lowercase + collapse whitespace). Skip silently when no
// match — the DB has 597 rows and sudovi.hr only covers ~66, so most
// won't match.
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const path = process.argv[2] || '/app/sudovi-courts.jsonl'
const txt = await fs.readFile(path, 'utf-8')
const records = txt.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

const allCourts = await client.query('SELECT id, name FROM courts')
const fold = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const byFolded = new Map()
for (const r of allCourts.rows) byFolded.set(fold(r.name), r.id)

let matched = 0, updated_hours = 0, inserted_deps = 0, skipped = []

for (const rec of records) {
  const id = byFolded.get(fold(rec.name))
  if (!id) {
    skipped.push(rec.name)
    continue
  }
  matched++

  const hours = rec.time_availability || {}
  const sets = []
  const vals = []
  let i = 1
  for (const key of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'notes']) {
    if (hours[key]) {
      sets.push(`"time_availability_${key}" = $${i++}`)
      vals.push(hours[key])
    }
  }
  if (sets.length) {
    vals.push(id)
    await client.query(`UPDATE courts SET ${sets.join(', ')} WHERE id = $${i}`, vals)
    updated_hours++
  }

  if (rec.departments && rec.departments.length > 0) {
    await client.query('DELETE FROM courts_departments WHERE _parent_id = $1', [id])
    for (let k = 0; k < rec.departments.length; k++) {
      const d = rec.departments[k]
      await client.query(
        `INSERT INTO courts_departments
           (_order, _parent_id, id, name, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [k + 1, id, randomUUID(), d.name, d.type || null],
      )
      inserted_deps++
    }
  }
}

console.log(`matched courts: ${matched}/${records.length}`)
console.log(`hours rows updated: ${updated_hours}`)
console.log(`departments inserted: ${inserted_deps}`)
if (skipped.length) {
  console.log(`unmatched (${skipped.length}):`)
  for (const n of skipped.slice(0, 10)) console.log(`  - ${n}`)
  if (skipped.length > 10) console.log(`  ... and ${skipped.length - 10} more`)
}

await client.end()
