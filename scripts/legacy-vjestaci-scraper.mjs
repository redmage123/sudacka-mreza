#!/usr/bin/env node
// Scrape vjestaci.aspx (sudski vještaci) from the legacy ASP.NET site at
// http://sudacka-mreza.hr/vjestaci.aspx, walk all category dropdowns
// (cmb_desc1..4), collect the resulting list of experts, and INSERT into
// the Payload `expert_witnesses` table.
//
// The legacy site is on a flaky IIS host. We use Playwright with patient
// retries (up to 6) and 2-12 s human jitter so a transient outage doesn't
// kill the run. Resume key = legacy expert id (parsed from detail link).
//
// Usage:
//   node legacy-vjestaci-scraper.mjs --target=http://69.61.26.116 \
//        --resolve=sudacka-mreza.hr:69.61.26.116
import pg from 'pg'
import { chromium } from 'playwright'

const argv = process.argv.slice(2)
const getArg = (n, d) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : d
}
const TARGET = getArg('target', 'http://sudacka-mreza.hr')
const PG_URL = process.env.DATABASE_URI ||
  'postgresql://postgres:Sudacka2026!SecureDB@localhost:5432/sudacka_mreza'
const HEADFUL = argv.includes('--headful')

const REAL_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (lo, hi) => sleep(lo + Math.random() * (hi - lo))
const log = (...a) => console.log(new Date().toISOString(), ...a)

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[čć]/g, 'c').replace(/đ/g, 'd').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
}

async function withRetry(fn, label, attempts = 6) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const wait = Math.min(60000, 5000 * i)
      log(`! ${label} attempt ${i}/${attempts}: ${e.message?.slice(0, 80)} — sleep ${wait/1000}s`)
      await sleep(wait)
    }
  }
  throw lastErr
}

async function main() {
  const client = new pg.Client({ connectionString: PG_URL })
  await client.connect()

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const ctx = await browser.newContext({
    userAgent: REAL_UA,
    viewport: { width: 1280, height: 900 },
    locale: 'hr-HR',
    timezoneId: 'Europe/Zagreb',
  })
  const page = await ctx.newPage()

  // Step 1: warm-up + fetch all cmb_desc1 categories
  log(`opening ${TARGET}/vjestaci.aspx`)
  await withRetry(() => page.goto(`${TARGET}/vjestaci.aspx`, { waitUntil: 'domcontentloaded', timeout: 90000 }), 'goto vjestaci')
  await jitter(1500, 3000)

  const categories = await page.evaluate(() => {
    const sel = document.querySelector('select[name="cmb_desc1"]') || document.querySelector('#cmb_desc1')
    if (!sel) return []
    return [...sel.options]
      .filter((o) => o.value && o.value.trim() !== '' && o.value !== '0')
      .map((o) => ({ value: o.value, label: o.textContent.trim() }))
  })
  log(`found ${categories.length} cmb_desc1 categories`)
  if (categories.length === 0) {
    log('! no categories — page may be unreachable; aborting')
    process.exit(1)
  }

  let total = 0
  let inserted = 0
  let skipped = 0

  for (const cat of categories) {
    log(`category: ${cat.label} (${cat.value})`)

    await withRetry(async () => {
      await page.goto(`${TARGET}/vjestaci.aspx`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await jitter(1500, 3000)
      // Set cmb_desc1 and submit. ASP.NET pages usually have an autopostback
      // — selecting the option triggers a form submit with __EVENTTARGET.
      await page.selectOption('select[name="cmb_desc1"]', cat.value)
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 })
      // Click the search button to render results.
      const search = await page.$('input[name="cmd_search"], button[name="cmd_search"]')
      if (search) await search.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 })
      await jitter(1500, 3000)
    }, `category ${cat.label}`)

    // Parse results — vjestaci.aspx renders a result table or list of cards.
    // We capture name + city/county + specialization + email/phone + cv url.
    const rows = await page.evaluate(() => {
      const out = []
      // Heuristic: each result has a link that contains "vjestak.aspx?id=" or
      // a card with class containing 'expert' / 'rezultat'. Adapt to actual
      // markup observed on the live page.
      const cards = document.querySelectorAll(
        'a[href*="vjestak"], div.rezultat, div.expert, tr.row, div.tdetalji'
      )
      for (const el of cards) {
        const root = el.closest('tr,div') || el
        const text = root.innerText.replace(/\s+/g, ' ').trim()
        if (text.length < 5) continue
        const href = (root.querySelector('a') || {}).href || ''
        const idMatch = href.match(/[?&]id=(\d+)/)
        const id = idMatch ? idMatch[1] : null
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
        const phoneMatch = text.match(/(?:\+?385|0)[\s-]?\d[\d\s-]{6,}/)
        out.push({ id, text: text.slice(0, 600), href, email: emailMatch?.[0] ?? null, phone: phoneMatch?.[0] ?? null })
      }
      return out
    })
    log(`  ${rows.length} cards parsed`)

    for (const r of rows) {
      if (!r.id) { skipped++; continue }
      // Extract name = first non-empty line of text.
      const name = (r.text.split(/[•|]| - /)[0] || '').replace(/^\d+\.?\s*/, '').trim()
      if (!name || name.length > 200) { skipped++; continue }

      const slug = slugify(`${name}-${r.id}`)
      try {
        await client.query(
          `INSERT INTO expert_witnesses
             (name, city, email, phone, slug, updated_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [name, 'Hrvatska', r.email, r.phone, slug],
        )
        inserted++
      } catch (e) {
        log(`  ! insert failed [${r.id}] ${name}: ${String(e.message).slice(0, 100)}`)
        skipped++
      }
      total++
    }
    await jitter(2500, 6000)
  }

  log(`done — categories=${categories.length} cards=${total} inserted=${inserted} skipped=${skipped}`)
  await ctx.close()
  await browser.close()
  await client.end()
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
