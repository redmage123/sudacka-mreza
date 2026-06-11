// Recon: find the canonical Imenik URLs on pravosudje.gov.hr via Playwright.
import { chromium } from 'playwright'
const ROOT = 'https://pravosudje.gov.hr/'

const b = await chromium.launch()
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0' })
const p = await ctx.newPage()
p.setDefaultTimeout(20000)

await p.goto(ROOT, { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)

// Pull all anchor text + href pairs, filter for registry-related.
const links = await p.evaluate(() => {
  return [...document.querySelectorAll('a[href]')].map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href'),
  }))
})
const KEYS = /imenik|vje[šs]tak|tuma[čc]|stalni sudski|procjenitelj|prevoditelj/i
const hits = links.filter((l) => KEYS.test(l.text) || KEYS.test(l.href ?? ''))
const seen = new Set()
console.log(`hits on homepage: ${hits.length}`)
for (const h of hits) {
  if (seen.has(h.href)) continue
  seen.add(h.href)
  console.log(`  ${h.text.slice(0, 60).padEnd(60)} ${h.href}`)
}

// Try a site-search via the visible search form.
await p.goto(`${ROOT}rezultati-pretrazivanja/49?q=${encodeURIComponent('imenik stalnih sudskih vjestaka')}`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
const searchHits = await p.evaluate(() => {
  return [...document.querySelectorAll('a[href]')]
    .map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') }))
    .filter((l) => l.href && l.text)
})
console.log(`\nsearch result links: ${searchHits.length}`)
const sk = searchHits.filter((l) => /imenik|vje[šs]tak|tuma[čc]/i.test(l.text))
for (const h of sk.slice(0, 20)) {
  console.log(`  ${h.text.slice(0, 60).padEnd(60)} ${h.href}`)
}

await b.close()
