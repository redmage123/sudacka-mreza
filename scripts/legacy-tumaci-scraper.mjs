#!/usr/bin/env node
// Same shape as legacy-vjestaci-scraper.mjs but for tumaci.aspx (sudski tumači
// — court interpreters). Inserts into Payload `interpreters` table.
//
// The legacy form has cmb_desc1 = language and cmb_desc2 = specialty.
// We iterate languages and collect every interpreter listed.
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

  log(`opening ${TARGET}/tumaci.aspx`)
  await withRetry(() => page.goto(`${TARGET}/tumaci.aspx`, { waitUntil: 'domcontentloaded', timeout: 90000 }), 'goto tumaci')
  await jitter(1500, 3000)

  const languages = await page.evaluate(() => {
    const sel = document.querySelector('select[name="cmb_desc1"]') || document.querySelector('#cmb_desc1')
    if (!sel) return []
    return [...sel.options]
      .filter((o) => o.value && o.value.trim() !== '' && o.value !== '0')
      .map((o) => ({ value: o.value, label: o.textContent.trim() }))
  })
  log(`found ${languages.length} languages`)
  if (languages.length === 0) {
    log('! no language dropdown — aborting')
    process.exit(1)
  }

  let total = 0, inserted = 0, skipped = 0

  for (const lang of languages) {
    log(`language: ${lang.label}`)
    await withRetry(async () => {
      await page.goto(`${TARGET}/tumaci.aspx`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await jitter(1500, 3000)
      await page.selectOption('select[name="cmb_desc1"]', lang.value)
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 })
      const search = await page.$('input[name="cmd_search"], button[name="cmd_search"]')
      if (search) await search.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 })
      await jitter(1500, 3000)
    }, `lang ${lang.label}`)

    const rows = await page.evaluate(() => {
      const out = []
      const cards = document.querySelectorAll(
        'a[href*="tumac"], div.rezultat, div.tdetalji, tr.row'
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
    log(`  ${rows.length} cards`)

    for (const r of rows) {
      if (!r.id) { skipped++; continue }
      const name = (r.text.split(/[•|]| - /)[0] || '').replace(/^\d+\.?\s*/, '').trim()
      if (!name || name.length > 200) { skipped++; continue }
      const slug = slugify(`${name}-${r.id}`)
      try {
        await client.query(
          `INSERT INTO interpreters
             (name, city, email, phone, slug, updated_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [name, 'Hrvatska', r.email, r.phone, slug],
        )
        inserted++
      } catch (e) {
        log(`  ! insert [${r.id}] ${name}: ${String(e.message).slice(0, 100)}`)
        skipped++
      }
      total++
    }
    await jitter(2500, 6000)
  }

  log(`done — langs=${languages.length} cards=${total} inserted=${inserted} skipped=${skipped}`)
  await ctx.close()
  await browser.close()
  await client.end()
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
