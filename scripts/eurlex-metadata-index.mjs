#!/usr/bin/env node
// EUR-Lex metadata indexer.
//
// Fills eurlex_docs with EN-title embeddings for every CELEX in sectors
// 3 (legislation) and 6 (case law), so the /eur-lex semantic search page
// returns useful hits TODAY, before the (slow) full-text fetcher catches
// up.
//
// Pipeline per scope:
//   1. Year-bucketed SPARQL pull (celex, date, eng_title) — chunked under
//      the EU SPARQL endpoint's 10 000-row server cap.
//   2. For each row, embed the title via Ollama (nomic-embed-text, 768d)
//      and INSERT INTO eurlex_docs(..., chunk_text=title, embedding=v).
//   3. Resumable: skips rows whose (celex, lang, chunk_idx=0) already exist.
//
// Once the slower full-text fetcher produces corpus.jsonl, eurlex-index.mjs
// will append additional chunks (chunk_idx > 0) without disturbing these
// title rows.
//
// Usage:
//   node eurlex-metadata-index.mjs --scope=caselaw
//   node eurlex-metadata-index.mjs --scope=legislation
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const SCOPE = getArg('scope', 'caselaw')
const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:Sudacka2026!SecureDB@localhost:5432/sudacka_mreza'
const OLLAMA = process.env.OLLAMA_BASE || 'http://172.18.0.1:11434'
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'
const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql'
const PAGE_SIZE = 500
const MAX_QUERIES_PER_BUCKET = 30 // 30 * 500 = 15K cap; usually 10K WAF cap kicks first
const REQ_DELAY = parseInt(getArg('delay', '900'), 10)
const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString(), ...a)

function celexPattern() {
  if (SCOPE === 'caselaw') return '^6[0-9]{4}[A-Z]{2}[0-9]{4,}$'
  if (SCOPE === 'legislation') return '^3[0-9]{4}[A-Z][0-9]{4,}$'
  throw new Error('--scope must be caselaw | legislation')
}

function buildQuery(offset, fromYear, toYear) {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX dc:  <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?celex ?date ?title WHERE {
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document      ?date .
  FILTER (regex(STR(?celex), "${celexPattern()}"))
  FILTER (year(?date) >= ${fromYear} && year(?date) <= ${toYear})
  ?expr cdm:expression_belongs_to_work ?work ;
        cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
        cdm:expression_title ?title .
}
ORDER BY ASC(?date)
LIMIT ${PAGE_SIZE}
OFFSET ${offset}
`.trim()
}

async function runQuery(query) {
  const body = new URLSearchParams({ query, format: 'application/sparql-results+json' })
  const r = await fetch(SPARQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent': REAL_UA,
    },
    body,
  })
  if (!r.ok) throw new Error(`SPARQL HTTP ${r.status}`)
  const j = await r.json()
  return j.results?.bindings ?? []
}

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`embed HTTP ${r.status}`)
  const j = await r.json()
  return j.embeddings?.[0]
}

const pgVecLit = (v) => `[${v.join(',')}]`

async function ensureSchema(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector')
  await client.query(`
    CREATE TABLE IF NOT EXISTS eurlex_docs (
      id          SERIAL PRIMARY KEY,
      celex       TEXT NOT NULL,
      lang        TEXT NOT NULL,
      scope       TEXT NOT NULL,
      date        DATE,
      title       TEXT,
      chunk_idx   INT NOT NULL DEFAULT 0,
      chunk_text  TEXT NOT NULL,
      embedding   vector(768),
      UNIQUE (celex, lang, chunk_idx)
    );
    CREATE INDEX IF NOT EXISTS eurlex_docs_celex_idx ON eurlex_docs(celex);
    CREATE INDEX IF NOT EXISTS eurlex_docs_scope_idx ON eurlex_docs(scope);
    CREATE INDEX IF NOT EXISTS eurlex_docs_lang_idx  ON eurlex_docs(lang);
  `)
}

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()
  await ensureSchema(client)

  // Year buckets — same scheme as eurlex-corpus.mjs.
  const now = new Date().getUTCFullYear() + 1
  const buckets = []
  let y = 1952
  while (y < now) {
    const end = Math.min(y + 4, now - 1)
    buckets.push([y, end])
    y = end + 1
  }

  let inserted = 0
  let skipped = 0

  for (const [fy, ty] of buckets) {
    log(`bucket ${fy}–${ty}`)
    let offset = 0
    for (let q = 0; q < MAX_QUERIES_PER_BUCKET; q++) {
      let rows
      try {
        rows = await runQuery(buildQuery(offset, fy, ty))
      } catch (e) {
        log(`  ! ${e.message} — back off 30s`)
        await sleep(30000)
        try {
          rows = await runQuery(buildQuery(offset, fy, ty))
        } catch (ee) {
          log(`  !! second failure: ${ee.message} — skip bucket`)
          break
        }
      }
      if (rows.length === 0) break
      for (const row of rows) {
        const celex = (row.celex?.value || '').trim()
        const date = (row.date?.value || '').slice(0, 10) || null
        const title = (row.title?.value || '').trim().slice(0, 1000)
        if (!celex || !title) {
          skipped++
          continue
        }
        const dup = await client.query(
          `SELECT 1 FROM eurlex_docs WHERE celex=$1 AND lang='en' AND chunk_idx=0 LIMIT 1`,
          [celex],
        )
        if (dup.rows.length > 0) {
          skipped++
          continue
        }
        try {
          const v = await embed(title)
          if (!v || v.length === 0) {
            skipped++
            continue
          }
          await client.query(
            `INSERT INTO eurlex_docs
               (celex, lang, scope, date, title, chunk_idx, chunk_text, embedding)
             VALUES ($1, 'en', $2, $3, $4, 0, $5, $6::vector)
             ON CONFLICT (celex, lang, chunk_idx) DO NOTHING`,
            [celex, SCOPE, date, title, title, pgVecLit(v)],
          )
          inserted++
        } catch (e) {
          log(`  ! ${celex}: ${String(e.message).slice(0, 100)}`)
          skipped++
        }
        if (inserted % 200 === 0) log(`  inserted=${inserted} skipped=${skipped}`)
      }
      log(`  q@${offset} +${rows.length} (inserted=${inserted})`)
      if (rows.length < PAGE_SIZE) break
      offset += PAGE_SIZE
      await sleep(REQ_DELAY)
    }
    await sleep(REQ_DELAY)
  }

  log(`done — inserted=${inserted}, skipped=${skipped}`)
  await client.end()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
