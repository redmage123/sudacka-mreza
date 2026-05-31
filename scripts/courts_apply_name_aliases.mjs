// Bridge remaining name variants. DB has "Puli - Pola" not "Puli-Pola",
// "Visoki prekršajni sud RH" not "...Republike Hrvatske".
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'

const ALIASES = {
  'Visoki prekršajni sud Republike Hrvatske': 'Visoki prekršajni sud RH',
  'Visoki trgovački sud RH':                  'Visoki trgovački sud Republike Hrvatske',
  'Visoki upravni sud RH':                    'Visoki upravni sud Republike Hrvatske',
  'Općinski sud u Puli-Pola':                 'Općinski sud u Puli - Pola',
  'Županijski sud u Puli-Pola':               'Županijski sud u Puli - Pola',
}

const records = (await fs.readFile('/app/sudovi-courts.jsonl', 'utf-8'))
  .trim().split('\n').filter(Boolean).map(l => JSON.parse(l))

const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

let touched = 0, deps_inserted = 0
for (const rec of records) {
  const target = ALIASES[rec.name]
  if (!target) continue
  const r = await client.query('SELECT id FROM courts WHERE name = $1 LIMIT 1', [target])
  if (r.rowCount === 0) { console.log(`  [miss] ${target} not in DB`); continue }
  const id = r.rows[0].id

  const h = rec.time_availability || {}
  const sets = [], vals = []
  let i = 1
  for (const key of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday','notes']) {
    if (h[key]) { sets.push(`"time_availability_${key}" = $${i++}`); vals.push(h[key]) }
  }
  if (sets.length) {
    vals.push(id)
    await client.query(`UPDATE courts SET ${sets.join(', ')} WHERE id = $${i}`, vals)
  }

  if (rec.departments && rec.departments.length) {
    await client.query('DELETE FROM courts_departments WHERE _parent_id = $1', [id])
    for (let k = 0; k < rec.departments.length; k++) {
      const d = rec.departments[k]
      await client.query(
        `INSERT INTO courts_departments (_order, _parent_id, id, name, type) VALUES ($1,$2,$3,$4,$5)`,
        [k+1, id, randomUUID(), d.name, d.type || null]
      )
      deps_inserted++
    }
  }
  touched++
  console.log(`  [ok]   ${rec.name} -> ${target} (deps=${rec.departments.length}, hours=${!!h.monday})`)
}

console.log(`\ntouched: ${touched}, deps inserted: ${deps_inserted}`)
await client.end()
