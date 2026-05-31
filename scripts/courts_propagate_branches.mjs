// Branches share their parent court's working hours + departments. Name
// pattern: 'Općinski sud u Bjelovaru - Stalna služba u Virovitici' has
// parent 'Općinski sud u Bjelovaru'. We split on ' - ' and look up the
// part before it as the parent.
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URI })
await client.connect()

const allCourts = await client.query('SELECT id, name FROM courts')
const byName = new Map()
for (const r of allCourts.rows) byName.set(r.name, r.id)

let parents_with_data = 0
let branches_propagated = 0
let deps_inserted = 0

for (const row of allCourts.rows) {
  const name = row.name
  // Split on the en/em/regular dash variants that "Stalna služba" courts use.
  const m = name.match(/^(.+?)\s*[-–—]\s*Stalna služba\s/i)
  if (!m) continue
  const parentName = m[1].trim()
  const parentId = byName.get(parentName)
  if (!parentId || parentId === row.id) continue

  // Fetch parent's data
  const parentRes = await client.query(
    `SELECT time_availability_monday, time_availability_tuesday,
            time_availability_wednesday, time_availability_thursday,
            time_availability_friday, time_availability_saturday,
            time_availability_sunday, time_availability_notes,
            jurisdiction_scope
       FROM courts WHERE id = $1`,
    [parentId],
  )
  if (parentRes.rows.length === 0) continue
  const p = parentRes.rows[0]

  // Departments on parent
  const depRes = await client.query(
    `SELECT name, type FROM courts_departments
       WHERE _parent_id = $1 ORDER BY _order`,
    [parentId],
  )

  const hasAnyData =
    p.time_availability_monday || p.time_availability_friday || depRes.rows.length > 0
  if (!hasAnyData) continue
  parents_with_data++

  // Don't overwrite branch's own data if any.
  const branchRes = await client.query(
    `SELECT time_availability_monday FROM courts WHERE id = $1`,
    [row.id],
  )
  const branchHasHours = branchRes.rows[0]?.time_availability_monday
  if (!branchHasHours) {
    await client.query(
      `UPDATE courts SET
         time_availability_monday    = $1,
         time_availability_tuesday   = $2,
         time_availability_wednesday = $3,
         time_availability_thursday  = $4,
         time_availability_friday    = $5,
         time_availability_saturday  = $6,
         time_availability_sunday    = $7,
         time_availability_notes     = $8
       WHERE id = $9`,
      [
        p.time_availability_monday,
        p.time_availability_tuesday,
        p.time_availability_wednesday,
        p.time_availability_thursday,
        p.time_availability_friday,
        p.time_availability_saturday,
        p.time_availability_sunday,
        p.time_availability_notes,
        row.id,
      ],
    )
  }

  const branchDepRes = await client.query(
    `SELECT COUNT(*)::int AS n FROM courts_departments WHERE _parent_id = $1`,
    [row.id],
  )
  if (branchDepRes.rows[0].n === 0 && depRes.rows.length > 0) {
    for (let i = 0; i < depRes.rows.length; i++) {
      const d = depRes.rows[i]
      await client.query(
        `INSERT INTO courts_departments
           (_order, _parent_id, id, name, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [i + 1, row.id, randomUUID(), d.name, d.type],
      )
      deps_inserted++
    }
  }

  branches_propagated++
}

console.log(`parents with data: ${parents_with_data}`)
console.log(`branches propagated: ${branches_propagated}`)
console.log(`departments inserted on branches: ${deps_inserted}`)

await client.end()
