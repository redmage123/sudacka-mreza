// Capture XHR endpoints when loading the Popis pages so we can hit them directly.
import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0' })
const p = await ctx.newPage()
p.setDefaultTimeout(25000)

for (const url of [
  'https://mpudt.gov.hr/UserDocsImages/26670',
  'https://mpudt.gov.hr/UserDocsImages/26660',
]) {
  console.log(`\n=== ${url} ===`)
  const xhr = []
  p.on('response', (r) => {
    const u = r.url()
    if (/api|json|xml|odata|search|list|imenik|vje|tumac|popis/i.test(u) && !/mpudt\.gov\.hr\/Scripts|cdn|jquery|track|analytic|font/i.test(u)) {
      xhr.push(`${r.status()} ${u.slice(0, 200)}`)
    }
  })
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3000)
  // Print downloads and document links the page rendered (post-JS).
  const docs = await p.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') }))
      .filter((l) => /\.(pdf|xlsx?|csv|docx?)$/i.test(l.href ?? ''))
  )
  console.log('  files linked:')
  for (const d of docs.slice(0, 25)) console.log(`    ${d.text.slice(0, 60).padEnd(60)} ${d.href?.slice(0, 110)}`)
  console.log('  xhr seen:')
  for (const x of xhr.slice(0, 10)) console.log(`    ${x}`)
}

await b.close()
