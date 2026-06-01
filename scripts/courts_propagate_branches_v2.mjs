// Widen the branch detector: catch every '- <something> u <place>'
// pattern, not just Stalna služba. Examples in the DB:
//   '... - Stalna služba u X'
//   '... - ZK odjel u X'
//   '... - Odjel u X'
//   '... - Odjeljenje u X'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const BRANCH_RE = /^(.+?)\s*[-–—]\s*(?:Stalna\s+služba|ZK\s+odjel|Odjeljenje|Odjel|Pisarnica)\s+u\s/i

const c = new pg.Client({ connectionString: process.env.DATABASE_URI })
await c.connect()

const all = await c.query('SELECT id, name FROM courts')
const byName = new Map()
for (const r of all.rows) {
  if (!byName.has(r.name)) byName.set(r.name, [])
  byName.get(r.name).push(r.id)
}

let propagated = 0, deps_inserted = 0, hours_set = 0

for (const row of all.rows) {
  const m = row.name.match(BRANCH_RE)
  if (!m) continue
  const parentName = m[1].trim()
  const parentIds = (byName.get(parentName) || []).filter((x) => x !== row.id)
  if (!parentIds.length) continue

  // Pick the first parent that actually has data.
  let pickedParent = null
  for (const pid of parentIds) {
    const pr = await c.query(
      `SELECT time_availability_monday, time_availability_tuesday,
              time_availability_wednesday, time_availability_thursday,
              time_availability_friday, time_availability_saturday,
              time_availability_sunday, time_availability_notes
         FROM courts WHERE id = $1`,
      [pid],
    )
    const dr = await c.query(
      'SELECT COUNT(*)::int AS n FROM courts_departments WHERE _parent_id = $1',
      [pid],
    )
    if (pr.rows[0]?.time_availability_monday || dr.rows[0].n > 0) {
      pickedParent = { id: pid, ...pr.rows[0], depCount: dr.rows[0].n }
      break
    }
  }
  if (!pickedParent) continue

  // Branch hours
  const branchHr = await c.query(
    'SELECT time_availability_monday FROM courts WHERE id = $1',
    [row.id],
  )
  if (!branchHr.rows[0]?.time_availability_monday && pickedParent.time_availability_monday) {
    await c.query(
      `UPDATE courts SET
         time_availability_monday=$1, time_availability_tuesday=$2,
         time_availability_wednesday=$3, time_availability_thursday=$4,
         time_availability_friday=$5, time_availability_saturday=$6,
         time_availability_sunday=$7, time_availability_notes=$8
       WHERE id=$9`,
      [
        pickedParent.time_availability_monday,
        pickedParent.time_availability_tuesday,
        pickedParent.time_availability_wednesday,
        pickedParent.time_availability_thursday,
        pickedParent.time_availability_friday,
        pickedParent.time_availability_saturday,
        pickedParent.time_availability_sunday,
        pickedParent.time_availability_notes,
        row.id,
      ],
    )
    hours_set++
  }

  // Branch departments
  const bdc = await c.query(
    'SELECT COUNT(*)::int AS n FROM courts_departments WHERE _parent_id = $1',
    [row.id],
  )
  if (bdc.rows[0].n === 0 && pickedParent.depCount > 0) {
    const deps = await c.query(
      'SELECT name, type FROM courts_departments WHERE _parent_id = $1 ORDER BY _order',
      [pickedParent.id],
    )
    for (let i = 0; i < deps.rows.length; i++) {
      const d = deps.rows[i]
      await c.query(
        `INSERT INTO courts_departments (_order, _parent_id, id, name, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [i + 1, row.id, randomUUID(), d.name, d.type],
      )
      deps_inserted++
    }
  }
  propagated++
}

console.log(`branches propagated: ${propagated}`)
console.log(`hours rows set:      ${hours_set}`)
console.log(`departments inserted: ${deps_inserted}`)
await c.end()
