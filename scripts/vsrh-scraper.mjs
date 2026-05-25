#!/usr/bin/env node
// VSRH (Vrhovni sud RH / Supreme Court of Croatia) incremental scraper.
//
// Source: https://odluke.sudovi.hr (SupraNova / ANON case-law portal). Plain
// HTML, ASP.NET-rendered, no anti-bot. Date-bounded querying via the
// dd_from/dd_to params is the killer feature — we maintain a "last seen
// decision date" cursor and only ask for newer rows on each run.
//
// Usage:
//   node vsrh-scraper.mjs                 # incremental from cursor
//   node vsrh-scraper.mjs --backfill-from=01.01.2024
//   node vsrh-scraper.mjs --max-pages=200
import * as cheerio from 'cheerio'
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}

const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:postgres@localhost:5432/sudacka_mreza'
const VSRH_COURT_ID = parseInt(process.env.VSRH_COURT_ID ?? '195', 10)
const MAX_PAGES = parseInt(getArg('max-pages', '200'), 10)
const BACKFILL_FROM = getArg('backfill-from', null)
const REQ_DELAY_MS = parseInt(getArg('delay', '1100'), 10)

const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

function fmtDate(d) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}
function parseDate(s) {
  // "D.M.YYYY" or "DD.MM.YYYY"
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': REAL_UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'hr-HR,hr;q=0.9,en;q=0.8',
    },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return await r.text()
}

function parseList(html) {
  const $ = cheerio.load(html)
  const rows = []
  $('a[href*="/Document/View?id="]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const m = href.match(/id=([0-9a-fA-F-]{36})/)
    if (!m) return
    const id = m[1]
    // case number is the link text on these listing rows
    const caseNumber = $(el).text().trim()
    // Walk up to the container row to harvest siblings — the layout is
    // <div class="result-row"><a>case#</a> ... <span>type</span> ... <span>date</span>...
    const container = $(el).closest('.result, .result-row, li, tr, div').first()
    const text = container.text().replace(/\s+/g, ' ').trim()
    const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)
    const dateRaw = dateMatch ? dateMatch[1] : null
    const date = dateRaw ? parseDate(dateRaw) : null
    rows.push({ id, caseNumber, date, snippet: text.slice(0, 400) })
  })
  // dedupe by id
  const seen = new Set()
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

async function fetchDetail(id) {
  const url = `https://odluke.sudovi.hr/Document/View?id=${id}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const meta = {}
  // Best-effort metadata extraction — labels are Croatian "Poslovni broj:" etc.
  $('dt, .meta-label, .label').each((_, el) => {
    const k = $(el).text().trim().replace(/:$/, '').toLowerCase()
    const v = $(el).next('dd, .meta-value, .value').first().text().trim()
    if (k && v) meta[k] = v
  })
  const body = $('.decision-text, #DecisionText, .doc-body').first().text().trim()
  const ecliMatch = html.match(/ECLI:HR:VSRH:\d{4}:[0-9A-Za-z]+/i)
  return {
    url,
    caseNumber: meta['poslovni broj'] || meta['case number'] || '',
    decisionType: meta['vrsta odluke'] || '',
    date: parseDate(meta['datum odluke'] || meta['datum'] || '') || null,
    publishedDate: parseDate(meta['datum objave'] || '') || null,
    ecli: ecliMatch ? ecliMatch[0] : null,
    body: body.slice(0, 100000),
    fullHtml: html,
  }
}

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()

  // Determine cursor (last decision date we have for VSRH).
  let cursorFrom
  if (BACKFILL_FROM) {
    cursorFrom = parseDate(BACKFILL_FROM)
    if (!cursorFrom) throw new Error(`bad --backfill-from=${BACKFILL_FROM}`)
    log(`backfill mode — start from ${BACKFILL_FROM}`)
  } else {
    const r = await client.query(
      `SELECT max(date) AS d FROM court_decisions WHERE court_id = $1`,
      [VSRH_COURT_ID],
    )
    const max = r.rows[0]?.d
    if (max) {
      // Re-fetch from one day before to catch same-day late publications.
      const d = new Date(max)
      d.setUTCDate(d.getUTCDate() - 1)
      cursorFrom = d
    } else {
      cursorFrom = new Date(Date.UTC(2000, 0, 1))
    }
    log(`incremental mode — cursor from ${fmtDate(cursorFrom)}`)
  }

  const today = new Date()
  let inserted = 0
  let seen = 0
  let knownIds = new Set()
  // Dedup by slug (we encode the SupraNova UUID into slug=vsrh-<uuid>).
  const allKnown = await client.query(
    `SELECT slug FROM court_decisions WHERE court_id = $1 AND slug LIKE 'vsrh-%'`,
    [VSRH_COURT_ID],
  )
  for (const row of allKnown.rows) {
    const m = row.slug.match(/^vsrh-([0-9a-fA-F-]{36})$/)
    if (m) knownIds.add(m[1])
  }
  log(`already have ${knownIds.size} VSRH decisions`)

  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = `https://odluke.sudovi.hr/Document/DisplayList?ct=vs&dd_from=${encodeURIComponent(
      fmtDate(cursorFrom),
    )}&dd_to=${encodeURIComponent(fmtDate(today))}&sort=date_asc&page=${p}`
    let html
    try {
      html = await fetchHtml(url)
    } catch (e) {
      log(`! page ${p} fetch failed: ${e.message}`)
      break
    }
    const rows = parseList(html)
    log(`page ${p}: ${rows.length} rows`)
    if (rows.length === 0) break

    for (const row of rows) {
      seen++
      if (knownIds.has(row.id)) continue
      try {
        const detail = await fetchDetail(row.id)
        const slug = `vsrh-${row.id}`
        const title = detail.caseNumber || row.caseNumber || row.id
        const date = detail.date || row.date || new Date()
        // VSRH decisions span all five mainline subject areas; we leave
        // decision_type as a coarse default ('civil') and let downstream
        // enrichers refine it. Sudacka Mreza categorisation already keys
        // off `category` and the parsed Croatian "Vrsta odluke" label.
        const lower = (detail.decisionType || '').toLowerCase()
        let dtype = 'civil'
        if (/kazn|kž|krimi/.test(lower)) dtype = 'criminal'
        else if (/upravn/.test(lower)) dtype = 'administrative'
        else if (/ustav/.test(lower)) dtype = 'constitutional'
        else if (/trgov|gosp|pž/.test(lower)) dtype = 'commercial'
        await client.query(
          `INSERT INTO court_decisions
             (title, court_id, decision_type, date, case_number, summary, category, lang, slug,
              ecli, external_url, full_text_plain, updated_at, created_at)
           VALUES ($1, $2, $3::enum_court_decisions_decision_type, $4, $5, $6, $7,
                   $8::enum_court_decisions_lang, $9, $10, $11, $12, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [
            title.slice(0, 500),
            VSRH_COURT_ID,
            dtype,
            date,
            detail.caseNumber || row.caseNumber || null,
            detail.body.slice(0, 4000),
            detail.decisionType || 'VSRH',
            'hr',
            slug,
            detail.ecli,
            detail.url,
            detail.body,
          ],
        )
        knownIds.add(row.id)
        inserted++
        await sleep(REQ_DELAY_MS)
      } catch (e) {
        log(`  ! detail fail ${row.id}: ${String(e.message).slice(0, 120)}`)
      }
    }
    await sleep(REQ_DELAY_MS)
  }

  log(`done — seen ${seen}, inserted ${inserted}`)
  await client.end()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
