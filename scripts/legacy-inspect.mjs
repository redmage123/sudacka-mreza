#!/usr/bin/env node
// Diagnose the legacy site's vjestaci.aspx + tumaci.aspx form structure so
// the actual scrapers can use the right selectors. Visits each page once
// with a real-browser fingerprint, dumps every <select> and its option
// count, plus a sample card markup if any results appear by default.
import { chromium } from 'playwright'

const TARGET = process.argv[2] || 'http://sudacka-mreza.hr'
const PATHS = ['/vjestaci.aspx', '/tumaci.aspx', '/sudovi.aspx']

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 900 },
  locale: 'hr-HR',
  timezoneId: 'Europe/Zagreb',
  extraHTTPHeaders: { 'Accept-Language': 'hr-HR,hr;q=0.9,en;q=0.8' },
})
const page = await ctx.newPage()

for (const path of PATHS) {
  const url = `${TARGET}${path}`
  console.log(`\n=== ${url} ===`)
  let resp
  try {
    resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
  } catch (e) {
    console.log('GOTO_FAIL', e.message.slice(0, 100))
    continue
  }
  console.log('status', resp?.status())
  await page.waitForTimeout(2000)

  const info = await page.evaluate(() => {
    const selects = [...document.querySelectorAll('select')].map((s) => ({
      name: s.name, id: s.id, optionCount: s.options.length,
      sample: [...s.options].slice(0, 3).map((o) => `${o.value}=${(o.textContent || '').trim().slice(0, 30)}`),
    }))
    const tables = document.querySelectorAll('table').length
    const links = [...document.querySelectorAll('a[href*=".aspx?id="]')].slice(0, 5).map((a) => a.href)
    const buttons = [...document.querySelectorAll('input[type="submit"], button')].map((b) => ({ name: b.name, value: b.value || b.textContent }))
    return {
      title: document.title,
      selects,
      tables,
      links,
      buttons,
      bodyLen: document.body.innerText.length,
    }
  })
  console.log(JSON.stringify(info, null, 2))
}

await ctx.close()
await browser.close()
