#!/usr/bin/env node
// Narodne Novine (Croatian Official Gazette) incremental scraper.
//
// Source: https://narodne-novine.nn.hr — exposes a sitemap index of every
// per-issue sitemap, plus per-act JSON-LD metadata + printhtml/PDF body.
// Documented rate limit: 3 req/s (we use ~2 req/s).
//
// Strategy:
//   1. GET /sitemap.xml (the index of per-issue sitemaps)
//   2. Diff per-issue sitemap URLs vs last-seen cursor
//   3. For each new issue → enumerate ELI act URLs from that sitemap
//   4. For each act → fetch /json-ld + /hrv/printhtml; upsert by ELI URI.
//
// Cursor is the issue's "issued" date from the sitemap lastmod tag.
//
// Usage:
//   node nn-scraper.mjs                    # incremental
//   node nn-scraper.mjs --since=2026-01-01
import * as cheerio from 'cheerio'
import pg from 'pg'

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:Sudacka2026!SecureDB@localhost:5432/sudacka_mreza'
const SINCE = getArg('since', null) // YYYY-MM-DD; defaults to MAX(issued) - 7d
const REQ_DELAY_MS = parseInt(getArg('delay', '450'), 10) // ~2 req/s

const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

async function fetchText(url, accept = 'text/html') {
  const r = await fetch(url, {
    headers: { 'User-Agent': REAL_UA, Accept: accept, 'Accept-Language': 'hr-HR,hr;q=0.9' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return await r.text()
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': REAL_UA, Accept: 'application/ld+json,application/json' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return await r.json()
}

function parseUrlset(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out = []
  $('url').each((_, el) => {
    const loc = $(el).find('loc').first().text().trim()
    const lastmod = $(el).find('lastmod').first().text().trim()
    if (loc) out.push({ loc, lastmod })
  })
  return out
}

function parseSitemapIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out = []
  $('sitemap').each((_, el) => {
    const loc = $(el).find('loc').first().text().trim()
    const lastmod = $(el).find('lastmod').first().text().trim()
    if (loc) out.push({ loc, lastmod })
  })
  return out
}

function eliFromUrl(url) {
  // Per-act ELI URI lives at ".../eli/sluzbeni/<year>/<broj>/<redni>" — strip
  // any /hrv/printhtml etc. suffix.
  const m = url.match(/\/eli\/[^/]+\/\d{4}\/[^/]+\/[^/?#]+/)
  return m ? m[0] : null
}

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()

  // Ensure storage table for nn acts. We deliberately keep this as its own
  // table (nn_acts) rather than shoehorn into court_decisions, since these
  // are legislation, not judgments.
  await client.query(`
    CREATE TABLE IF NOT EXISTS nn_acts (
      eli              TEXT PRIMARY KEY,
      issue_year       INT NOT NULL,
      issue_no         INT NOT NULL,
      act_no           TEXT NOT NULL,
      kategorija       TEXT NOT NULL,
      title            TEXT,
      issued_date      DATE,
      doc_type         TEXT,
      eurovoc_subjects JSONB,
      body_text        TEXT,
      pdf_url          TEXT,
      json_ld          JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS nn_acts_issued_idx ON nn_acts(issued_date);
    CREATE INDEX IF NOT EXISTS nn_acts_kategorija_idx ON nn_acts(kategorija);
  `)

  let cursorIso
  if (SINCE) {
    cursorIso = SINCE
    log(`since override — ${cursorIso}`)
  } else {
    const r = await client.query(`SELECT max(issued_date) AS d FROM nn_acts`)
    const m = r.rows[0]?.d
    if (m) {
      const d = new Date(m)
      d.setUTCDate(d.getUTCDate() - 7)
      cursorIso = d.toISOString().slice(0, 10)
    } else {
      cursorIso = '2024-01-01' // sane default for first run
    }
    log(`incremental cursor — ${cursorIso}`)
  }
  const cursor = new Date(cursorIso)

  const idxXml = await fetchText('https://narodne-novine.nn.hr/sitemap.xml', 'application/xml')
  const indexEntries = parseSitemapIndex(idxXml)
  log(`sitemap-index: ${indexEntries.length} per-issue sitemaps total`)

  // Filter to issues newer than cursor + sluzbeni (kategorija 1) only — we
  // intentionally skip oglasni/medunarodni for the first pass. Old NN
  // sitemap-index entries lack a lastmod tag, so filter primarily by the
  // year embedded in the URL pattern (sitemap_1_YYYY_NN.xml).
  const cursorYear = cursor.getUTCFullYear()
  const wanted = indexEntries.filter((e) => {
    const m = e.loc.match(/sitemap_1_(\d{4})_\d+\.xml$/)
    if (!m) return false
    const issueYear = parseInt(m[1], 10)
    if (issueYear < cursorYear) return false
    const lm = e.lastmod ? new Date(e.lastmod) : null
    if (lm && lm < cursor) return false
    return true
  })
  log(`new candidate issues since ${cursorIso}: ${wanted.length}`)

  let inserted = 0
  let seen = 0
  for (const issue of wanted) {
    let urlsetXml
    try {
      urlsetXml = await fetchText(issue.loc, 'application/xml')
    } catch (e) {
      log(`! issue sitemap fail ${issue.loc}: ${e.message}`)
      continue
    }
    const acts = parseUrlset(urlsetXml).filter((u) => /\/eli\//.test(u.loc))
    log(`  ${issue.loc} → ${acts.length} acts`)
    for (const act of acts) {
      seen++
      const eli = eliFromUrl(act.loc)
      if (!eli) continue

      // skip if already ingested
      const dup = await client.query(`SELECT 1 FROM nn_acts WHERE eli = $1 LIMIT 1`, [eli])
      if (dup.rows.length > 0) continue

      // /YYYY/<broj>/<redni>
      const m = eli.match(/\/eli\/([^/]+)\/(\d{4})\/([^/]+)\/([^/]+)$/)
      if (!m) continue
      const [, kategorija, year, broj, redni] = m

      let jsonLd = null
      let title = null
      let issuedDate = null
      let docType = null
      let subjects = null
      try {
        jsonLd = await fetchJson(`https://narodne-novine.nn.hr${eli}/json-ld`)
        const g = Array.isArray(jsonLd['@graph']) ? jsonLd['@graph'][0] : jsonLd
        title = g?.['http://purl.org/dc/terms/title']?.['@value'] || g?.title || null
        issuedDate =
          g?.['http://purl.org/dc/terms/issued']?.['@value'] ||
          g?.['http://purl.org/dc/terms/dateSubmitted']?.['@value'] ||
          null
        docType = g?.['@type'] || null
        subjects = g?.['http://eurovoc.europa.eu/subject'] || null
      } catch (e) {
        log(`  ! json-ld fail ${eli}: ${String(e.message).slice(0, 80)}`)
      }
      await sleep(REQ_DELAY_MS)

      let bodyText = ''
      try {
        const html = await fetchText(`https://narodne-novine.nn.hr${eli}/hrv/printhtml`)
        const $ = cheerio.load(html)
        // Fallback title parse for old acts where JSON-LD 404s.
        if (!title) {
          const h = $('h1, .nn-naslov, .title, .doc-title').first().text().trim()
          if (h) title = h.slice(0, 500)
        }
        bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 1000000)
      } catch (e) {
        log(`  ! printhtml fail ${eli}: ${String(e.message).slice(0, 80)}`)
      }
      await sleep(REQ_DELAY_MS)

      const pdfUrl = `https://narodne-novine.nn.hr${eli}/hrv/pdf`

      try {
        await client.query(
          `INSERT INTO nn_acts
             (eli, issue_year, issue_no, act_no, kategorija, title, issued_date,
              doc_type, eurovoc_subjects, body_text, pdf_url, json_ld)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (eli) DO NOTHING`,
          [
            eli,
            parseInt(year, 10),
            parseInt(broj, 10) || 0,
            redni,
            kategorija,
            title,
            issuedDate ? new Date(issuedDate) : null,
            JSON.stringify(docType),
            subjects ? JSON.stringify(subjects) : null,
            bodyText,
            pdfUrl,
            jsonLd ? JSON.stringify(jsonLd) : null,
          ],
        )
        inserted++
      } catch (e) {
        log(`  ! insert fail ${eli}: ${String(e.message).slice(0, 100)}`)
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
