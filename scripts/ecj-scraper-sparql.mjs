#!/usr/bin/env node
// ECJ scraper — SPARQL edition.
//
// EUR-Lex publishes CELEX-coded judgments via their public SPARQL endpoint
// at https://publications.europa.eu/webapi/rdf/sparql. There is no WAF in
// front of it, so we don't need a headless browser, stealth plugins, or
// CAPTCHA dance.
//
// Usage:
//   node ecj-scraper-sparql.mjs [--limit=200] [--keyword=Croatia]
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const LIMIT = parseInt(getArg('limit', '200'), 10)
const KEYWORD = getArg('keyword', 'Croatia')

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:Sudacka2026!SecureDB@localhost:5432/sudacka_mreza'
const ECJ_COURT_ID = parseInt(process.env.ECJ_COURT_ID ?? '355', 10)

function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

// ECJ judgments = sector 6, document type J. Filter title (eng) by keyword.
// `cdm:resource_legal_id_celex` gives the CELEX id; we pull title and date too.
function buildQuery(limit, keyword) {
  const safeKw = keyword.replace(/["\\]/g, '')
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX dc:  <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?work ?celex ?title ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document      ?date .
  FILTER (regex(STR(?celex), "^6[0-9]{4}[A-Z]{2}[0-9]{4,}$"))
  OPTIONAL {
    ?expr cdm:expression_belongs_to_work ?work ;
          cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
          cdm:expression_title ?title .
  }
  FILTER (BOUND(?title) && regex(STR(?title), "${safeKw}", "i"))
}
ORDER BY DESC(?date)
LIMIT ${limit}
`.trim()
}

async function runQuery(query) {
  const body = new URLSearchParams({ query, format: 'application/sparql-results+json' })
  const r = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent': 'sudacka-mreza-ecj-scraper/1.0 (+https://sudacka-mreza.hr)',
    },
    body,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`SPARQL HTTP ${r.status}: ${text.slice(0, 300)}`)
  }
  const j = await r.json()
  return j.results?.bindings ?? []
}

async function main() {
  log(`SPARQL ECJ scrape — keyword="${KEYWORD}" limit=${LIMIT}`)
  const pg_client = new pg.Client({ connectionString: PG_URL })
  await pg_client.connect()
  const existing = await pg_client.query(
    `SELECT celex FROM court_decisions WHERE court_id = $1 AND celex IS NOT NULL`,
    [ECJ_COURT_ID],
  )
  const known = new Set(existing.rows.map((r) => r.celex))
  log(`already have ${known.size} ECJ decisions in DB`)

  const rows = await runQuery(buildQuery(LIMIT, KEYWORD))
  log(`SPARQL returned ${rows.length} candidates`)

  let inserted = 0
  let skipped = 0
  for (const row of rows) {
    const celex = row.celex?.value
    if (!celex) {
      skipped++
      continue
    }
    if (known.has(celex)) {
      skipped++
      continue
    }
    const title = (row.title?.value || celex).slice(0, 500)
    const date = row.date?.value ? new Date(row.date.value) : new Date()
    const slug = `ecj-${celex.toLowerCase()}`
    const externalUrl = `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`
    try {
      await pg_client.query(
        `INSERT INTO court_decisions
           (title, court_id, decision_type, date, case_number, summary, category, lang, slug,
            celex, ecli, external_url, updated_at, created_at)
         VALUES ($1, $2, $3::enum_court_decisions_decision_type, $4, $5, $6, $7, $8::enum_court_decisions_lang, $9,
                 $10, $11, $12, NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [title, ECJ_COURT_ID, 'ecj', date, celex, title, 'ecj', 'en', slug, celex, null, externalUrl],
      )
      known.add(celex)
      inserted++
    } catch (e) {
      log(`  insert fail ${celex}: ${e.message.slice(0, 100)}`)
      skipped++
    }
  }
  log(`done — inserted ${inserted}, skipped ${skipped}`)
  await pg_client.end()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
