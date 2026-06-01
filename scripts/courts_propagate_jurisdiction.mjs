import pg from 'pg'
const BRANCH_RE = /^(.+?)\s*[-–—]\s*(?:Stalna\s+služba|ZK\s+odjel|Odjeljenje|Odjel|Pisarnica)\s+u\s/i

const c = new pg.Client({ connectionString: process.env.DATABASE_URI })
await c.connect()
const all = await c.query('SELECT id, name, jurisdiction_scope FROM courts')
const byName = new Map()
for (const r of all.rows) {
  if (!byName.has(r.name)) byName.set(r.name, [])
  byName.get(r.name).push(r)
}
let propagated = 0
for (const row of all.rows) {
  if (row.jurisdiction_scope) continue
  const m = row.name.match(BRANCH_RE)
  if (!m) continue
  const parents = (byName.get(m[1].trim()) || []).filter(p => p.jurisdiction_scope)
  if (!parents.length) continue
  await c.query('UPDATE courts SET jurisdiction_scope = $1 WHERE id = $2',
    [parents[0].jurisdiction_scope, row.id])
  propagated++
}
console.log('jurisdiction propagated to branches:', propagated)
const r = await c.query("SELECT COUNT(*)::int AS n FROM courts WHERE jurisdiction_scope IS NOT NULL")
console.log('final jurisdiction coverage:', r.rows[0].n, '/', all.rows.length)
await c.end()
