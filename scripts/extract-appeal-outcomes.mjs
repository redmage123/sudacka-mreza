#!/usr/bin/env node
// Cite-chase pass — for every decision whose decisionType is an appellate
// review (županijski, vrhovni, ustavni), parse its dispositive and the
// referenced first-instance case_number, then set
// court_decisions.appeal_outcome + appealed_decision_id on the original.
//
// Dispositive signal mapping:
//   "Potvrđuje se"  → upheld
//   "Preinačuje se" → modified
//   "Ukida se"      → overturned
//
// Reference signal (case_number of lower court):
//   "presudu Općinskog suda u ... poslovni broj <CASE>"
//   "rješenje ... pod brojem <CASE>"
//
// Idempotent — only updates first-instance decisions whose appeal_outcome
// is currently NULL.
//
// Usage (from Toronto):
//   node scripts/extract-appeal-outcomes.mjs --dry-run
//   node scripts/extract-appeal-outcomes.mjs
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry-run')
const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F~ -q'

const log = (...a) => console.log(new Date().toISOString(), ...a)
const psql = (sqlText) =>
  execSync(`${PG} -c "${sqlText.replaceAll('"', '\\"')}"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const esc = (s) => s == null ? null : String(s).replaceAll("'", "''")

const detectOutcome = (text) => {
  if (/Potvrđuje\s+se|potvrđuje\s+se\s+presuda/i.test(text)) return 'upheld'
  if (/Preinačuje\s+se|preinačuje\s+se\s+presuda/i.test(text)) return 'modified'
  if (/Ukida\s+se|ukida\s+se\s+presuda/i.test(text)) return 'overturned'
  return null
}

// Case-number reference patterns. Croatian court case numbers usually
// match patterns like "P-123/2024-3", "Gž-456/2024-2", "R1 Ob-1/2024".
const CASE_PATTERNS = [
  /Općinskog\s+suda\s+u\s+\S+[^,.]{0,80}?(?:poslovni\s+broj|broj)\s*:?\s*([A-Z][A-Za-z0-9-]*\s*[-]?\s*\d+\/\d{2,4}(?:-\d+)?)/gi,
  /(?:presud(?:u|om)|rješenj(?:e|em))\s+(?:[^.,]{0,40})?(?:broj|posl\.?\s*br\.?)\s*:?\s*([A-Z][A-Za-z0-9-]*\s*[-]?\s*\d+\/\d{2,4}(?:-\d+)?)/gi,
]

const extractReferencedCases = (text) => {
  const found = new Set()
  for (const re of CASE_PATTERNS) {
    let m
    while ((m = re.exec(text)) !== null) {
      found.add(m[1].replace(/\s+/g, ' ').trim())
    }
  }
  return [...found]
}

// Pull appellate decisions. The decision_type enum on master is
// civil/criminal/commercial/administrative/constitutional/ecj/ecthr; the
// appellate court is encoded in court_id (the court's name/level), so we
// also check the title text for "županijski" / "vrhovni" keywords.
const rows = psql(`
  SELECT cd.id, regexp_replace(cd.full_text_plain, E'[\\n\\r\\t]+', ' ', 'g') AS full_text_plain
  FROM court_decisions cd
  JOIN courts c ON c.id = cd.court_id
  WHERE cd.full_text_plain IS NOT NULL
    AND length(cd.full_text_plain) > 200
    AND (
      c.name ILIKE '%županijski%' OR
      c.name ILIKE '%vrhovni%' OR
      c.name ILIKE '%ustavni%' OR
      c.name ILIKE '%upravni sud%' OR
      cd.title ILIKE '%županij%' OR
      cd.title ILIKE '%vrhovn%'
    )
`).trim().split('\n').filter(Boolean)

log(`appellate decisions to scan: ${rows.length}`)
let matched = 0
let linked = 0
for (const row of rows) {
  const tabIdx = row.indexOf('~')
  const appellateId = row.slice(0, tabIdx)
  const text = row.slice(tabIdx + 1)

  const outcome = detectOutcome(text)
  if (!outcome) continue
  const refs = extractReferencedCases(text)
  if (!refs.length) continue
  matched++
  if (DRY) {
    if (matched <= 5) log(`appellate=${appellateId} outcome=${outcome} refs=`, refs.slice(0, 3))
    continue
  }
  for (const caseNum of refs) {
    const sql = `
      UPDATE court_decisions
         SET appeal_outcome = '${outcome}',
             appealed_decision_id = ${appellateId},
             appeal_filed = true,
             appeal_type = COALESCE(appeal_type, 'zalba')
       WHERE case_number = '${esc(caseNum)}'
         AND appeal_outcome IS NULL
       RETURNING id
    `
    const out = psql(sql).trim()
    if (out) linked += out.split('\n').length
  }
  if (matched % 100 === 0) log(`scanned=${matched} linked=${linked}`)
}
log(`done — appellate decisions with extractable outcome=${matched} first-instance linked=${linked}`)
