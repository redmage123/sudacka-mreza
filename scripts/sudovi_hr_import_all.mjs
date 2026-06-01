// Re-import sudovi.hr data into ALL court rows matching each scraped
// name. The DB has 248 names with duplicate rows (496 rows total in
// dup-name groups); the earlier import used 'LIMIT 1' and only touched
// the first row of each pair, leaving 83% of courts uncovered.
//
// Same logic as scripts/sudovi_hr_import.mjs but:
//   - SELECT id FROM courts WHERE name = $1   (no LIMIT)
//   - applies hours UPDATE to every id
//   - replaces courts_departments for every id
//   - same name aliases applied across all matching rows
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const ALIASES = {
  'Visoki prekršajni sud Republike Hrvatske': 'Visoki prekršajni sud RH',
  'Visoki trgovački sud RH':                  'Visoki trgovački sud Republike Hrvatske',
  'Visoki upravni sud RH':                    'Visoki upravni sud Republike Hrvatske',
  'Općinski sud u Puli-Pola':                 'Općinski sud u Puli - Pola',
  'Županijski sud u Puli-Pola':               'Županijski sud u Puli - Pola',
}

const txt = await fs.readFile('/app/sudovi-courts.jsonl', 'utf-8')
const records = txt.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

const allCourts = await client.query('SELECT id, name FROM courts')
const fold = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const byFolded = new Map()
for (const r of allCourts.rows) {
  const k = fold(r.name)
  if (!byFolded.has(k)) byFolded.set(k, [])
  byFolded.get(k).push(r.id)
}

let matched_records = 0, ids_touched = 0, hours_updates = 0, deps_inserted = 0

for (const rec of records) {
  const aliasedName = ALIASES[rec.name] || rec.name
  const ids = byFolded.get(fold(aliasedName)) || []
  if (!ids.length) continue
  matched_records++

  const hours = rec.time_availability || {}
  const sets = []
  const vals = []
  let i = 1
  for (const k of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','notes']) {
    if (hours[k]) { sets.push(`"time_availability_${k}" = $${i++}`); vals.push(hours[k]) }
  }

  for (const id of ids) {
    ids_touched++
    if (sets.length) {
      const v = vals.slice()
      v.push(id)
      await client.query(`UPDATE courts SET ${sets.join(', ')} WHERE id = $${i}`, v)
      hours_updates++
    }
    if (rec.departments && rec.departments.length > 0) {
      await client.query('DELETE FROM courts_departments WHERE _parent_id = $1', [id])
      for (let k = 0; k < rec.departments.length; k++) {
        const d = rec.departments[k]
        await client.query(
          `INSERT INTO courts_departments (_order, _parent_id, id, name, type)
           VALUES ($1, $2, $3, $4, $5)`,
          [k + 1, id, randomUUID(), d.name, d.type || null],
        )
        deps_inserted++
      }
    }
  }
}

console.log(`scraped records: ${records.length}`)
console.log(`matched records: ${matched_records}`)
console.log(`ids touched:     ${ids_touched}`)
console.log(`hours updates:   ${hours_updates}`)
console.log(`deps inserted:   ${deps_inserted}`)

await client.end()
