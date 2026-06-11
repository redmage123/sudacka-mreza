// Playwright scrape of sudovi.hr to enrich Courts collection (website, email,
// president, phone, full address). Writes JSON; apply via apply_sudovi_hr.py.
//
// Run:    node scripts/scrape_sudovi_hr_playwright.mjs
// Output: /tmp/sudovi_hr_courts.json
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const ROOT = 'https://sudovi.hr/'
const OUT = '/tmp/sudovi_hr_courts.json'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (sudacka-mreza/1.0)',
  locale: 'hr',
})
const page = await ctx.newPage()
page.setDefaultTimeout(30000)

console.log('[1/3] discover')
await page.goto(ROOT, { waitUntil: 'networkidle' }).catch(() => {})

// sudovi.hr renders courts via a navigation menu / cards. Pull every internal
// link that looks like a court detail page.
const links = await page.evaluate(() => {
  const out = []
  const seen = new Set()
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || ''
    if (!href) continue
    const full = new URL(href, location.href).toString()
    if (seen.has(full)) continue
    if (!/sudovi\.hr/i.test(full)) continue
    // Court pages typically include "sud-u-" or "-sud" in the path.
    if (!/sud(-u-|i-|ovi|ski)/i.test(full)) continue
    if (/#/.test(full)) continue
    seen.add(full)
    out.push({ url: full, text: (a.textContent || '').trim().slice(0, 120) })
  }
  return out
})
console.log(`  ${links.length} candidate court links from root`)

// Walk every court page; extract details.
console.log('[2/3] visit each court')
const results = []
let n = 0
for (const { url, text } of links) {
  n++
  try {
    await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(400)
    const detail = await page.evaluate(() => {
      const txt = document.body.innerText
      const html = document.body.innerHTML
      const nameEl = document.querySelector('h1, .court-name, [class*="naslov"], title')
      const name = (nameEl?.textContent || '').trim()
      const emailMatch = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
      let websites = [...html.matchAll(/https?:\/\/[^\s"<>')]+/g)].map((m) => m[0])
      websites = websites.filter((w) => !/(facebook|instagram|twitter|x\.com|sudovi\.hr|youtube|google\.|\.pdf$|\.png$|\.jpg$)/i.test(w))
      const phoneMatch = txt.match(/(?:\+?385\s*|0)\s*\d[\d\s\-/().]{6,}\d/)
      const presidentMatch = txt.match(/(?:predsjednic[ae]|predsjednik)\s*(?:suda)?\s*[:\-–]?\s*([A-ZŠĐČĆŽ][\wšđčćžŠĐČĆŽ.\-]+(?:\s+[A-ZŠĐČĆŽ][\wšđčćžŠĐČĆŽ.\-]+)+)/i)
      const addrMatch = txt.match(/(?:adresa)\s*[:\-–]?\s*([^\n]{6,140})/i)
      return {
        name,
        website: websites[0] || null,
        email: emailMatch ? emailMatch[0] : null,
        president: presidentMatch ? presidentMatch[1].trim() : null,
        phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null,
        address: addrMatch ? addrMatch[1].trim() : null,
      }
    })
    if (!detail.name) continue
    results.push({ url, link_text: text, ...detail })
    if (n % 10 === 0) console.log(`  ${n}/${links.length}: ${detail.name.slice(0, 60)}`)
  } catch (e) {
    console.log(`  err ${url}: ${e.message}`)
  }
}

console.log(`[3/3] write ${OUT}`)
writeFileSync(OUT, JSON.stringify(results, null, 2))
console.log(`OK ${results.length} court records → ${OUT}`)
await browser.close()
