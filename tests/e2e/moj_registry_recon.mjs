// Drill into the "Uvid u registre" landing + Stalni sudski vještaci pages.
import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0' })
const p = await ctx.newPage()
p.setDefaultTimeout(20000)

for (const url of [
  'https://mpudt.gov.hr/uvid-u-registre-22088/22088',
  'https://mpudt.gov.hr/istaknute-teme/stalni-sudski-vjestaci/26662',
  'https://mpudt.gov.hr/istaknute-teme/stalni-sudski-tumaci/26654',
]) {
  console.log(`\n=== ${url} ===`)
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  const links = await p.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => ({
      text: (a.textContent || '').trim(),
      href: a.getAttribute('href'),
    })),
  )
  const keep = links.filter((l) => {
    const tl = l.text.toLowerCase()
    const hl = (l.href || '').toLowerCase()
    return /imenik|vje[šs]tak|tuma[čc]|stalni|registr|popis|pdf|xls|csv|sudski|procjeni|prevoditelj/.test(tl + ' ' + hl)
  })
  const seen = new Set()
  for (const l of keep) {
    if (seen.has(l.href)) continue
    seen.add(l.href)
    console.log(`  ${l.text.slice(0, 55).padEnd(55)} ${l.href?.slice(0, 90)}`)
  }
  // Headings + visible text snippets
  const h = await p.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((x) => x.textContent?.trim()))
  console.log('  headings:', h.slice(0, 8))
}

await b.close()
