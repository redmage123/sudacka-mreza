#!/usr/bin/env node
// EUR-Lex full corpus builder for Gemma fine-tuning.
//
// Two phases:
//   Phase A — Discover: SPARQL paginated query of every CELEX in the chosen
//             scope (default: sector 6 = case law, all doc types). Writes a
//             CSV index to <out>/index.csv with columns celex,date,title.
//   Phase B — Fetch: for each CELEX in the index, pull the EN+HR full text
//             via the public legal-content endpoint and write one JSONL
//             line per document to <out>/corpus.jsonl. Resumable: skips
//             celex values already present in the output.
//
// Usage:
//   node eurlex-corpus.mjs --phase=discover --scope=caselaw --out=/workspace/eurlex
//   node eurlex-corpus.mjs --phase=fetch    --scope=caselaw --out=/workspace/eurlex \
//        --langs=en,hr --concurrency=4 --delay=1500
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}

const PHASE = getArg('phase', 'discover')
const SCOPE = getArg('scope', 'caselaw') // caselaw | legislation | both
const OUT = getArg('out', './eurlex')
const LANGS = getArg('langs', 'en,hr').split(',')
const CONCURRENCY = parseInt(getArg('concurrency', '4'), 10)
const DELAY = parseInt(getArg('delay', '1500'), 10)
const PAGE_SIZE = 500
const MAX_QUERIES = parseInt(getArg('max-queries', '500'), 10)

const SPARQL = 'https://publications.europa.eu/webapi/rdf/sparql'
const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString(), ...a)

fs.mkdirSync(OUT, { recursive: true })

function celexPattern() {
  if (SCOPE === 'caselaw') return '^6[0-9]{4}[A-Z]{2}[0-9]{4,}$'
  if (SCOPE === 'legislation') return '^3[0-9]{4}[A-Z][0-9]{4,}$'
  if (SCOPE === 'both') return '^[36][0-9]{4}[A-Z]+[0-9]{4,}$'
  throw new Error('--scope must be caselaw | legislation | both')
}

function buildDiscoverQuery(offset) {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex ;
        cdm:work_date_document      ?date .
  FILTER (regex(STR(?celex), "${celexPattern()}"))
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

async function phaseDiscover() {
  log(`phase=discover scope=${SCOPE} out=${OUT}/index.csv`)
  const idxPath = path.join(OUT, 'index.csv')
  const fd = fs.openSync(idxPath, 'a')
  try {
    if (fs.statSync(idxPath).size === 0) fs.writeSync(fd, 'celex,date\n')
    let offset = 0
    let totalRows = 0
    for (let q = 0; q < MAX_QUERIES; q++) {
      log(`  query #${q + 1} offset=${offset}`)
      let rows
      try {
        rows = await runQuery(buildDiscoverQuery(offset))
      } catch (e) {
        log(`  ! ${e.message} — backing off 30s`)
        await sleep(30000)
        rows = await runQuery(buildDiscoverQuery(offset))
      }
      for (const row of rows) {
        const celex = (row.celex?.value || '').trim()
        const date = (row.date?.value || '').slice(0, 10)
        if (celex) {
          fs.writeSync(fd, `${celex},${date}\n`)
          totalRows++
        }
      }
      log(`    +${rows.length} rows (total ${totalRows})`)
      if (rows.length < PAGE_SIZE) break
      offset += PAGE_SIZE
      await sleep(DELAY)
    }
    log(`discover done — ${totalRows} CELEX rows → ${idxPath}`)
  } finally {
    fs.closeSync(fd)
  }
}

async function fetchCelexText(celex, lang) {
  const url = `https://eur-lex.europa.eu/legal-content/${lang.toUpperCase()}/TXT/?uri=CELEX:${celex}`
  const r = await fetch(url, {
    headers: {
      'User-Agent': REAL_UA,
      'Accept-Language': lang === 'hr' ? 'hr-HR,hr;q=0.9' : 'en-GB,en;q=0.9',
      Accept: 'text/html',
    },
  })
  if (!r.ok) return null
  const html = await r.text()
  // crude extraction — strip nav, keep main content area
  // EUR-Lex wraps body text in <div id="document1"> on most legal-content pages
  const m = html.match(/<div[^>]*id=["']document1["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
  let chunk = m ? m[1] : html
  chunk = chunk
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return chunk.length >= 500 ? chunk : null
}

async function phaseFetch() {
  const idxPath = path.join(OUT, 'index.csv')
  if (!fs.existsSync(idxPath)) throw new Error(`run --phase=discover first (no ${idxPath})`)
  const corpusPath = path.join(OUT, 'corpus.jsonl')
  // Resume: skip celex values already in corpus.jsonl
  const seen = new Set()
  if (fs.existsSync(corpusPath)) {
    const lines = fs.readFileSync(corpusPath, 'utf8').split('\n')
    for (const l of lines) {
      try {
        const o = JSON.parse(l)
        if (o.celex && o.lang) seen.add(`${o.celex}:${o.lang}`)
      } catch {
        /* skip */
      }
    }
  }
  log(`phase=fetch resume=${seen.size} celex×lang already in ${corpusPath}`)

  const allCsv = fs.readFileSync(idxPath, 'utf8').split('\n').slice(1).filter(Boolean)
  log(`index has ${allCsv.length} CELEX rows`)
  const fd = fs.openSync(corpusPath, 'a')
  try {
    let i = 0
    let written = 0
    let q = []
    const consume = async (job) => {
      try {
        const text = await fetchCelexText(job.celex, job.lang)
        if (text && text.length > 500) {
          const obj = {
            celex: job.celex,
            lang: job.lang,
            date: job.date,
            text,
          }
          fs.writeSync(fd, JSON.stringify(obj) + '\n')
          written++
        }
      } catch (e) {
        log(`  ! fetch ${job.celex}/${job.lang} ${String(e.message).slice(0, 80)}`)
      }
    }
    for (const line of allCsv) {
      const [celex, date] = line.split(',')
      for (const lang of LANGS) {
        const k = `${celex}:${lang}`
        if (seen.has(k)) continue
        q.push({ celex, date, lang })
      }
      while (q.length >= CONCURRENCY) {
        await Promise.all(q.splice(0, CONCURRENCY).map(consume))
        await sleep(DELAY)
      }
      i++
      if (i % 200 === 0) log(`  ${i}/${allCsv.length} processed, written=${written}`)
    }
    while (q.length > 0) {
      await Promise.all(q.splice(0, CONCURRENCY).map(consume))
      await sleep(DELAY)
    }
    log(`fetch done — wrote ${written} new docs → ${corpusPath}`)
  } finally {
    fs.closeSync(fd)
  }
}

async function main() {
  if (PHASE === 'discover') await phaseDiscover()
  else if (PHASE === 'fetch') await phaseFetch()
  else throw new Error('--phase must be discover | fetch')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
