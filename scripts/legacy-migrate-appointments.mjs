#!/usr/bin/env node
// Backfill `judges.appointment_date` + `judges.department` from the legacy
// `sudac_suda` table. For each judge that doesn't yet have an
// appointmentDate, pick the EARLIEST `datum_od` row (career start)
// and the most-recent active `odjel0` as the department mapping.
//
// Legacy departments (free-text in `odjel0..9`) are mapped to the new
// enum_judges_department via a heuristic table; unmappable values are
// left NULL and the freeform string stays in judges.specialization.
//
// Usage (from Toronto):
//   node scripts/legacy-migrate-appointments.mjs --dry-run
//   node scripts/legacy-migrate-appointments.mjs
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry-run')
const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F\\t -q'

const log = (...a) => console.log(new Date().toISOString(), ...a)
const psql = (sqlText) =>
  execSync(`${PG} -c "${sqlText.replaceAll('"', '\\"')}"`, { encoding: 'utf8' })

// Free-text → enum mapping. Editors can refine; unknown values stay NULL.
const DEPT_MAP = {
  'građanski': 'civil',
  'gradanski': 'civil',
  'civilno': 'civil',
  'kazneni': 'criminal',
  'krivični': 'criminal',
  'kazneno': 'criminal',
  'trgovački': 'commercial',
  'trgovacki': 'commercial',
  'trgovinsko': 'commercial',
  'upravni': 'administrative',
  'upravno': 'administrative',
  'ustavni': 'constitutional',
  'ustavno': 'constitutional',
  'prekršajni': 'misdemeanor',
  'prekrsajni': 'misdemeanor',
  'prekršajno': 'misdemeanor',
  'obiteljski': 'family',
  'obiteljsko': 'family',
  'radni': 'labour',
  'radno': 'labour',
}
const mapDept = (raw) => {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  for (const [k, v] of Object.entries(DEPT_MAP)) {
    if (key.includes(k)) return v
  }
  return null
}

// Pull legacy data: earliest datum_od + first non-null odjel0 per judge.
const rows = psql(`
  SELECT j.id, j.name, agg.first_appt, agg.odjel0_first
  FROM judges j
  LEFT JOIN LATERAL (
    SELECT MIN(ss.datum_od) AS first_appt,
           (array_agg(ss.odjel0 ORDER BY ss.datum_od)
              FILTER (WHERE ss.odjel0 IS NOT NULL AND ss.odjel0 <> ''))[1] AS odjel0_first
    FROM sudac_suda ss
    JOIN suci s ON s.id = ss.sudacid
    WHERE lower(trim(coalesce(s.ime0,'') || ' ' || coalesce(s.prezime0,''))) = lower(j.name)
  ) agg ON TRUE
  WHERE (j.appointment_date IS NULL OR j.department IS NULL)
    AND agg.first_appt IS NOT NULL
`).trim().split('\n').filter(Boolean)

log(`judges to backfill: ${rows.length}`)
if (DRY) {
  log('dry-run — sample:', rows.slice(0, 5))
  process.exit(0)
}

let updated = 0
let deptMapped = 0
for (const row of rows) {
  const [judgeId, , firstAppt, odjel0] = row.split('\t')
  const dept = mapDept(odjel0)
  if (dept) deptMapped++
  const sets = []
  if (firstAppt && firstAppt !== '\\N') sets.push(`appointment_date = '${firstAppt}'`)
  if (dept) sets.push(`department = '${dept}'`)
  if (odjel0 && odjel0 !== '\\N') sets.push(`specialization = COALESCE(specialization, '${odjel0.replaceAll("'", "''")}')`)
  if (firstAppt && firstAppt !== '\\N') {
    sets.push(`years_of_experience = COALESCE(years_of_experience, EXTRACT(YEAR FROM age(now(), '${firstAppt}')))`)
  }
  // Auto-split name → first_name/last_name on the same UPDATE so we touch
  // each row exactly once. Use NULLIF so we don't clobber edits.
  sets.push(`first_name = COALESCE(first_name, NULLIF(trim(split_part(name, ' ', 1)), ''))`)
  sets.push(`last_name  = COALESCE(last_name,  NULLIF(trim(substring(name from position(' ' in name) + 1)), ''))`)
  if (!sets.length) continue
  try {
    psql(`UPDATE judges SET ${sets.join(', ')} WHERE id = ${judgeId}`)
  } catch (e) {
    // Pre-existing duplicate slugs (a handful in legacy data) make the
    // index rebuild reject the update. Skip and log; editor fixes manually.
    if (/judges_slug_idx/.test(String(e))) {
      log(`skip dup-slug id=${judgeId}`)
      continue
    }
    throw e
  }
  updated++
  if (updated % 200 === 0) log(`updated ${updated}/${rows.length}`)
}
log(`done — updated=${updated} dept_mapped=${deptMapped} (${Math.round(100 * deptMapped / Math.max(updated, 1))}%)`)
