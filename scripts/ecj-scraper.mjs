#!/usr/bin/env node
// ECJ (Court of Justice of the EU) scraper — anti-bot hardened.
//
// Three changes from the original:
//   1. Real Chrome UA + matching client hints
//   2. playwright-extra + stealth plugin to defeat fingerprint detectors
//      (navigator.webdriver, missing plugins, headless WebGL, etc.)
//   3. Human-cadence pacing: random 6–14 s between pages, page scrolls,
//      randomised viewport, no `networkidle` (often a bot tell on its own)
//
// EUR-Lex *also* exposes a SPARQL endpoint
// (https://publications.europa.eu/webapi/rdf/sparql) which doesn't have a
// WAF in front of it. If this script keeps tripping CAPTCHAs even with
// stealth on, switch to SPARQL — `scripts/ecj-scraper-sparql.mjs` is the
// drop-in alternative.
//
// Usage: node ecj-scraper.mjs [--limit=100] [--headful] [--debug]
import { chromium as chromiumExtra } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import pg from 'pg'

chromiumExtra.use(StealthPlugin())

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const hasFlag = (n) => argv.some((x) => x === `--${n}` || x.startsWith(`--${n}=`))

const LIMIT = parseInt(getArg('limit', '100'), 10)
const HEADFUL = hasFlag('headful')
const DEBUG = hasFlag('debug')
const PG_URL =
  process.env.DATABASE_URI ??
  'postgresql://postgres:postgres@localhost:5432/sudacka_mreza'
const ECJ_COURT_ID = parseInt(process.env.ECJ_COURT_ID ?? '355', 10)

// Real Chrome 128 on Linux x86_64 — matches what an actual user reports.
const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

// Random viewport from a small pool of plausible desktop sizes.
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1680, height: 1050 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
]
const pickViewport = () => VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (minMs, maxMs) => sleep(minMs + Math.random() * (maxMs - minMs))

function log(...a) {
  console.log(new Date().toISOString(), ...a)
}

function searchUrl(page) {
  const params = new URLSearchParams({
    scope: 'EURLEX',
    text: 'Croatia',
    lang: 'en',
    SUBDOM_INIT: 'CASELAW',
    DTS_DOM: 'ALL',
    type: 'advanced',
    ACL_CAT: '',
    DTS_SUBDOM: 'CASELAW',
    qid: String(Date.now()),
    page: String(page),
  })
  return `https://eur-lex.europa.eu/search.html?${params.toString()}`
}

async function humanSettle(page) {
  // A single small scroll + brief idle period beats `networkidle` (which
  // some WAFs treat as suspicious because real users keep firing requests).
  try {
    await page.mouse.move(200 + Math.random() * 200, 300 + Math.random() * 200)
    await jitter(180, 420)
    await page.evaluate(() =>
      window.scrollBy({ top: 300 + Math.random() * 400, behavior: 'smooth' }),
    )
    await jitter(600, 1100)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  } catch {
    /* ignore — page might be navigating */
  }
}

async function detectCaptcha(page) {
  // EUR-Lex uses an interstitial; checking title + a couple of known
  // fragments catches both their own challenge page and Cloudflare.
  const title = (await page.title().catch(() => '')) || ''
  if (/just a moment|captcha|access denied|verify|attention required/i.test(title)) return title
  const html = await page.content().catch(() => '')
  if (
    /cf-challenge|hcaptcha|g-recaptcha|please complete the captcha/i.test(html) ||
    /Verify you are human/i.test(html)
  ) {
    return 'captcha-fragment-detected'
  }
  return null
}

async function main() {
  log(`starting ECJ scrape — limit=${LIMIT} headful=${HEADFUL}`)
  const browser = await chromiumExtra.launch({
    headless: !HEADFUL,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  })
  const ctx = await browser.newContext({
    userAgent: REAL_UA,
    viewport: pickViewport(),
    locale: 'en-US',
    timezoneId: 'Europe/Zagreb',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    extraHTTPHeaders: {
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'sec-ch-ua': '"Not.A/Brand";v="99", "Chromium";v="128", "Google Chrome";v="128"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  const pg_client = new pg.Client({ connectionString: PG_URL })
  await pg_client.connect()

  const existing = await pg_client.query(
    `SELECT celex FROM court_decisions WHERE court_id = $1 AND celex IS NOT NULL`,
    [ECJ_COURT_ID],
  )
  const knownCelex = new Set(existing.rows.map((r) => r.celex))
  log(`already have ${knownCelex.size} ECJ decisions in DB`)

  const page = await ctx.newPage()

  // Warm up with a benign hit on the homepage so the first results page
  // load looks like a continuation, not a deep-link from nowhere.
  try {
    await page.goto('https://eur-lex.europa.eu/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await humanSettle(page)
    await jitter(2000, 4500)
    const c = await detectCaptcha(page)
    if (c) log(`warn: captcha on warmup page (${c})`)
  } catch (e) {
    log(`warn: warmup goto failed (${e.message.slice(0, 80)})`)
  }

  let inserted = 0
  let fetched = 0
  let skipped = 0

  for (let p = 1; p <= Math.ceil(LIMIT / 10); p++) {
    const url = searchUrl(p)
    if (DEBUG) log(`page ${p} -> ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    // Modest wait + human-shaped activity. No networkidle.
    await jitter(1200, 2400)
    await humanSettle(page)

    const captcha = await detectCaptcha(page)
    if (captcha) {
      log(`✘ captcha/challenge on page ${p}: ${captcha}`)
      log(`  hint: rerun with --headful to solve once and keep cookies, or switch to SPARQL.`)
      break
    }

    const items = await page
      .$$eval(
        '.SearchResult, .EurlexContent_Headline, div[id^="PubFormat"]',
        (els) =>
          els.map((el) => {
            const text = el.textContent || ''
            const link = el.querySelector('a')?.getAttribute('href') || ''
            const celexMatch =
              text.match(/CELEX[:\s]*(6\d{4}[A-Z]{2}\d{4,})/i) ||
              link.match(/CELEX[:\s]*(6\d{4}[A-Z]{2}\d{4,})/i)
            return { text: text.trim().slice(0, 400), link, celex: celexMatch?.[1] ?? null }
          }),
      )
      .catch(() => [])

    const withCelex = items.filter((i) => i.celex)
    log(`page ${p}: ${withCelex.length} results with CELEX`)
    if (withCelex.length === 0) break

    for (const item of withCelex) {
      fetched++
      if (knownCelex.has(item.celex)) {
        skipped++
        continue
      }
      const title = (item.text.split('\n')[0] || item.celex).slice(0, 500)
      const slug = `ecj-${item.celex.toLowerCase()}`
      const externalUrl = `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${item.celex}`
      const dateMatch = item.celex.match(/^6(\d{4})/)
      const year = dateMatch ? parseInt(dateMatch[1], 10) : null
      const date = year ? new Date(`${year}-01-01`) : new Date()
      try {
        await pg_client.query(
          `INSERT INTO court_decisions
             (title, court_id, decision_type, date, case_number, summary, category, lang, slug,
              celex, ecli, external_url, updated_at, created_at)
           VALUES ($1, $2, $3::enum_court_decisions_decision_type, $4, $5, $6, $7, $8::enum_court_decisions_lang, $9,
                   $10, $11, $12, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [title, ECJ_COURT_ID, 'ecj', date, item.celex, item.text.slice(0, 1000),
            'ecj', 'en', slug, item.celex, null, externalUrl],
        )
        knownCelex.add(item.celex)
        inserted++
      } catch (e) {
        log(`  insert fail ${item.celex}: ${e.message.slice(0, 100)}`)
        skipped++
      }
      if (fetched >= LIMIT) break
    }
    if (fetched >= LIMIT) break

    // Random 6–14 s between pages — main visible cadence change.
    await jitter(6000, 14000)
  }

  log(`done — fetched ${fetched}, inserted ${inserted}, skipped ${skipped}`)
  await pg_client.end()
  await browser.close()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
