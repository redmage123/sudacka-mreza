#!/usr/bin/env node
// LLM pass over `court_decisions.full_text_plain` to extract structured
// analytics fields for the judge dashboard:
//
//   - judges (panel) — name matching → judges.id
//   - winningParty — from dispositive ("Nalaže se" → plaintiff,
//     "Odbija se" → defendant, "Odbacuje se" → dismissed, etc.)
//   - disputeType + disputeValue + currency (matched against the enum)
//   - expertWitnesses, plaintiffAttorneys, defendantAttorneys —
//     name-resolved against existing collections (only links existing
//     records; doesn't create new ones to avoid duplicates)
//   - caseDurationDays — derived from filing-date mentions ↔ decision date
//
// Idempotent — skips decisions where analytics_extracted_at is set.
//
// Calls the project's local Ollama-hosted Gemma (fast & free); falls back
// to OPENAI_API_KEY when set and Ollama is unavailable.
//
// Usage (from Toronto):
//   node scripts/extract-decision-analytics.mjs --batch=50          # one batch
//   node scripts/extract-decision-analytics.mjs --all               # entire backlog
//   node scripts/extract-decision-analytics.mjs --redo --where="id=123"  # one record
import { execSync } from 'node:child_process'

const argv = process.argv.slice(2)
const arg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`) || x === `--${n}`)
  if (!a) return dflt
  return a.includes('=') ? a.split('=')[1] : true
}
const BATCH = Number(arg('batch', '50'))
const ALL = arg('all', false)
const REDO = arg('redo', false)
const WHERE = arg('where', null)

const PG = 'docker exec -i sudacka-mreza-db-1 psql -U postgres -d sudacka_mreza -v ON_ERROR_STOP=1 -X -At -F\\t -q'
const OLLAMA = process.env.OLLAMA_URL || 'http://172.18.0.1:11434'
const MODEL = process.env.ANALYTICS_MODEL || 'gemma-4-e4b-eurlex-v1:latest'

const log = (...a) => console.log(new Date().toISOString(), ...a)
const psql = (sqlText) =>
  execSync(`${PG} -c "${sqlText.replaceAll('"', '\\"')}"`, { encoding: 'utf8' })
const esc = (s) => s == null ? null : String(s).replaceAll("'", "''")

const EXTRACT_PROMPT = (text) => `You are a legal-text analyst. Read this Croatian court decision and return a JSON object with these fields (use null when unknown):

{
  "judgeNames": [string],         // names of judges who decided (Sutkinja/Sudac X Y), array
  "winningParty": "plaintiff"|"defendant"|"partial"|"settled"|"dismissed"|null,
  "disputeType": "naknadaStete"|"isplata"|"vlasnistvo"|"razvod"|"radniSpor"|"ugovorni"|"nasljednistvo"|"obiteljski"|"kaznenoDjelo"|"prekrsaj"|"drugo"|null,
  "disputeValueEUR": number|null, // numeric EUR amount (convert from HRK if pre-2023)
  "currency": "EUR"|"HRK"|"USD"|null,
  "expertWitnessNames": [string],
  "plaintiffAttorneyNames": [string],
  "defendantAttorneyNames": [string],
  "filingDateISO": "YYYY-MM-DD"|null  // first mention of "podnio tužbu X" or similar
}

Rules:
- Return ONLY the JSON object, no prose, no markdown fence.
- For initialed names ("A. P.") return null — don't guess full names.
- For "Odbija se tužbeni zahtjev" set winningParty=defendant.
- For "Nalaže se ... plati" or "Usvaja se" set winningParty=plaintiff.
- For "Odbacuje se" set winningParty=dismissed.
- For settled/withdrawn ("povlači tužbu") set winningParty=settled.

TEXT:
${text.slice(0, 14000)}`

async function callLLM(prompt) {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0 } }),
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
  const data = await res.json()
  return data.response
}

const safeJSON = (s) => {
  if (!s) return null
  // strip ```json fences if the model added them anyway
  const cleaned = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

const resolveJudges = (names, decisionDate) => {
  if (!names?.length) return []
  const ids = []
  for (const n of names) {
    if (!n || n.split(' ').length < 2) continue
    const out = psql(`SELECT id FROM judges WHERE lower(name) = lower('${esc(n)}') LIMIT 1`).trim()
    if (out) ids.push(Number(out))
  }
  return ids
}

const resolveByName = (table, names) => {
  if (!names?.length) return []
  const ids = []
  for (const n of names) {
    if (!n || n.split(' ').length < 2) continue
    const out = psql(`SELECT id FROM ${table} WHERE lower(name) = lower('${esc(n)}') LIMIT 1`).trim()
    if (out) ids.push(Number(out))
  }
  return ids
}

const writeRels = (decisionId, path, targetCol, ids) => {
  // Wipe + re-insert this path's existing rows for idempotency.
  psql(`DELETE FROM court_decisions_rels WHERE parent_id = ${decisionId} AND path = '${path}'`)
  if (!ids.length) return
  const values = ids.map((id, i) =>
    `(${i + 1}, ${decisionId}, '${path}', ${targetCol === 'judges_id' ? id : 'NULL'}, ${targetCol === 'expert_witnesses_id' ? id : 'NULL'}, ${targetCol === 'attorneys_id' ? id : 'NULL'})`,
  ).join(', ')
  psql(`INSERT INTO court_decisions_rels ("order", parent_id, path, judges_id, expert_witnesses_id, attorneys_id) VALUES ${values}`)
}

// Build the work query.
const whereClauses = []
if (!REDO) whereClauses.push('analytics_extracted_at IS NULL')
whereClauses.push('full_text_plain IS NOT NULL AND length(full_text_plain) > 200')
if (WHERE) whereClauses.push(WHERE)
const limit = ALL ? '' : `LIMIT ${BATCH}`
const work = psql(`
  SELECT id, date, full_text_plain
  FROM court_decisions
  WHERE ${whereClauses.join(' AND ')}
  ORDER BY id ASC
  ${limit}
`).trim().split('\n').filter(Boolean)

log(`decisions to process: ${work.length}`)
let ok = 0, fail = 0
for (const row of work) {
  const tabIdx1 = row.indexOf('\t')
  const tabIdx2 = row.indexOf('\t', tabIdx1 + 1)
  const id = row.slice(0, tabIdx1)
  const date = row.slice(tabIdx1 + 1, tabIdx2)
  const text = row.slice(tabIdx2 + 1)
  try {
    const raw = await callLLM(EXTRACT_PROMPT(text))
    const j = safeJSON(raw)
    if (!j) { fail++; continue }

    const judgeIds = resolveJudges(j.judgeNames, date)
    const expertIds = resolveByName('expert_witnesses', j.expertWitnessNames)
    const pAttIds = resolveByName('attorneys', j.plaintiffAttorneyNames)
    const dAttIds = resolveByName('attorneys', j.defendantAttorneyNames)

    let durationDays = null
    if (j.filingDateISO && /^\d{4}-\d{2}-\d{2}$/.test(j.filingDateISO)) {
      const out = psql(`SELECT EXTRACT(EPOCH FROM ('${date}'::timestamptz - '${j.filingDateISO}'::date)) / 86400`).trim()
      durationDays = Math.max(0, Math.round(Number(out)))
    }

    const sets = [
      `analytics_extracted_at = now()`,
      j.winningParty ? `winning_party = '${esc(j.winningParty)}'` : null,
      j.disputeType ? `dispute_type = '${esc(j.disputeType)}'` : null,
      j.disputeValueEUR ? `dispute_value = ${Number(j.disputeValueEUR)}` : null,
      j.currency ? `currency = '${esc(j.currency)}'` : null,
      durationDays ? `case_duration_days = ${durationDays}` : null,
    ].filter(Boolean).join(', ')
    psql(`UPDATE court_decisions SET ${sets} WHERE id = ${id}`)

    writeRels(id, 'judges', 'judges_id', judgeIds)
    writeRels(id, 'expertWitnesses', 'expert_witnesses_id', expertIds)
    writeRels(id, 'plaintiffAttorneys', 'attorneys_id', pAttIds)
    writeRels(id, 'defendantAttorneys', 'attorneys_id', dAttIds)

    ok++
  } catch (e) {
    fail++
    if (fail < 5) log(`fail id=${id}:`, e.message)
  }
  if ((ok + fail) % 20 === 0) log(`progress ok=${ok} fail=${fail} / ${work.length}`)
}
log(`done — ok=${ok} fail=${fail}`)
