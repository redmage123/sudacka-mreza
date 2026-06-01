// Populate every uncovered court with the legally-mandated minimum
// structure per Sudski poslovnik (Court Rulebook) NN 37/14 + amendments.
//
// Departments: every Croatian court must by law have at minimum a
//   Pisarnica (registry/clerks office) and an Ured predsjednika suda
//   (president's office). Non-misdemeanour courts additionally have a
//   Sudska uprava (court administration). Each baseline row is tagged
//   in its notes field so admins can tell it apart from sudovi.hr-
//   sourced data.
//
// Working hours: 07:00-15:00 Mon-Fri with party hours 09:00-12:00 is
//   the regulatory default per the Sudski poslovnik. The
//   time_availability_notes column carries the same regulatory-default
//   marker.
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const REGULATORY_DEPT_NOTE =
  'Standardna ustrojstvena struktura sukladno Sudskom poslovniku ' +
  '(NN 37/14 + izmjene). Konkretna struktura suda može se razlikovati.'

const REGULATORY_HOURS_NOTE =
  'Standardno regulatorno radno vrijeme sukladno Sudskom poslovniku. ' +
  'Pojedini sudovi mogu imati prilagođene termine - provjerite ' +
  'kod konkretnog suda ili na sudovi.hr.'

const DEFAULT_HOURS_BASE = '07:00-15:00 (stranke 09:00-12:00)'

// Court type -> standard department set.
function baselineDepartments(type) {
  const standard = [
    { name: 'Pisarnica',         type: 'registry' },
    { name: 'Ured predsjednika', type: 'president' },
  ]
  if (type !== 'misdemeanour' && type !== 'echr' && type !== 'ecj') {
    standard.push({ name: 'Sudska uprava', type: 'secretary' })
  }
  return standard.map((d) => ({ ...d, notes: REGULATORY_DEPT_NOTE }))
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URI })
await c.connect()

const courts = await c.query('SELECT id, type, time_availability_monday FROM courts')
const courtsWithDeps = new Set(
  (await c.query('SELECT DISTINCT _parent_id FROM courts_departments')).rows.map((r) => r._parent_id),
)

let dept_courts = 0, dept_rows = 0, hours_courts = 0

for (const court of courts.rows) {
  // Departments
  if (!courtsWithDeps.has(court.id)) {
    const dpts = baselineDepartments(court.type)
    for (let i = 0; i < dpts.length; i++) {
      const d = dpts[i]
      await c.query(
        `INSERT INTO courts_departments
           (_order, _parent_id, id, name, type, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [i + 1, court.id, randomUUID(), d.name, d.type, d.notes],
      )
      dept_rows++
    }
    dept_courts++
  }

  // Hours
  if (!court.time_availability_monday) {
    await c.query(
      `UPDATE courts SET
         time_availability_monday    = $1,
         time_availability_tuesday   = $1,
         time_availability_wednesday = $1,
         time_availability_thursday  = $1,
         time_availability_friday    = $1,
         time_availability_notes     = $2
       WHERE id = $3`,
      [DEFAULT_HOURS_BASE, REGULATORY_HOURS_NOTE, court.id],
    )
    hours_courts++
  }
}

console.log(`courts given baseline departments: ${dept_courts}`)
console.log(`department rows inserted:          ${dept_rows}`)
console.log(`courts given baseline hours:       ${hours_courts}`)
await c.end()
