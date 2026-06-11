// SM-REDESIGN §3.7 audit. Tests user-visible behavior on Toronto, NOT file existence.
import { chromium } from 'playwright'
const BASE = 'http://23.164.48.64'
const results = []
const log = (k, v, ...rest) => {
  results.push({ key: k, status: v, note: rest.join(' ') })
  const c = v === 'PASS' ? '\x1b[32m' : v === 'FAIL' ? '\x1b[31m' : '\x1b[33m'
  console.log(`${c}[${v}]\x1b[0m ${k} — ${rest.join(' ')}`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
const page = await ctx.newPage()
page.setDefaultTimeout(20000)

async function goto(path) {
  try { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 }) }
  catch { await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {}) }
  await page.waitForTimeout(1200)
}
async function countSelects() { return await page.locator('select, [role="combobox"]').count() }
async function countText(rx) { return await page.locator(`text=${rx}`).count() }
async function findPlaceholder(needle) {
  const inputs = await page.locator('input').elementHandles()
  for (const h of inputs) {
    const p = (await h.getAttribute('placeholder')) || ''
    if (p.toLowerCase().includes(needle.toLowerCase())) return p
  }
  return null
}
async function pageRenderedCount(min = 2) {
  // Cheap "this page actually has content" check.
  const h = await page.locator('h1, h2, h3').count()
  return h >= min
}

// ===== §3.7 main page (Stečaj overview) =====
await goto('/hr/stecaj')
log('§3.7 stecaj page renders', await pageRenderedCount(2) ? 'PASS' : 'FAIL',
  `headings count visible`)

// ===== §3.7.2 Search bar — text/court/assetCategory/assetType/debtor/trustee/status =====
// SM-REDESIGN says this search should be visible on /stecaj AND duplicated across subsections.
const stecajText = await findPlaceholder('tekst') || await findPlaceholder('pretra')
const stecajSelects = await countSelects()
log('§3.7.2 text search input', stecajText ? 'PASS' : 'FAIL', `placeholder=${stecajText||'NONE'}`)
log('§3.7.2 has 6+ dropdowns (court/asset×2/debtor/trustee/status)', stecajSelects >= 6 ? 'PASS' : 'FAIL',
  `selects=${stecajSelects} (needs court+assetCategory+assetType+debtor+trustee+status)`)

// ===== §3.7.3 10 latest cases on /stecaj =====
const cards = await page.locator('article, [data-listing], li').count()
log('§3.7.3 list of latest cases visible', cards >= 5 ? 'PASS' : 'FAIL', `list items=${cards}`)

// ===== §3.7.a Osnovno o stečaju (overview page) =====
await goto('/hr/stecaj/osnovno-stecaj')
const aRender = await pageRenderedCount(1)
log('§3.7.a overview page exists', aRender ? 'PASS' : 'FAIL', `url=${page.url().replace(BASE,'')}`)
// Repeat: §3.7.a.2 should have the same search bar
const aSel = await countSelects()
log('§3.7.a.2 inherits §3.7.2 search bar', aSel >= 6 ? 'PASS' : 'FAIL', `selects=${aSel}`)

// ===== §3.7.b Sale of assets (oglasi) =====
await goto('/hr/stecaj/oglasi')
const oglasiSel = await countSelects()
const oglasiCards = await page.locator('article, [data-listing], li').count()
log('§3.7.b oglasi page renders', oglasiCards >= 3 ? 'PASS' : 'FAIL', `items=${oglasiCards}`)
log('§3.7.b oglasi has full search', oglasiSel >= 6 ? 'PASS' : 'FAIL', `selects=${oglasiSel}`)

// ===== §3.7.c Bankruptcy Trustees — name + court search =====
await goto('/hr/stecaj/upravitelji')
const upPlace = await findPlaceholder('ime') || await findPlaceholder('prezime') || await findPlaceholder('upravitelj')
const upCourtSel = await countSelects()
log('§3.7.c trustees name search', upPlace ? 'PASS' : 'FAIL', `placeholder=${upPlace||'NONE'}`)
log('§3.7.c trustees court dropdown', upCourtSel >= 1 ? 'PASS' : 'FAIL', `selects=${upCourtSel}`)

// ===== §3.7.d Commercial Courts =====
await goto('/hr/stecaj/o-trgovackom-sudovanju')
const dRender = await pageRenderedCount(1)
log('§3.7.d commercial courts page exists', dRender ? 'PASS' : 'FAIL', `url=${page.url().replace(BASE,'')}`)
const dSel = await countSelects()
log('§3.7.d.2 inherits §3.7.2 search bar', dSel >= 6 ? 'PASS' : 'FAIL', `selects=${dSel}`)

// ===== §3.7.e Bankruptcy Laws — static page with list =====
await goto('/hr/stecaj/zakoni')
const lawsRender = await page.locator('a[href*="/zakoni/"], article, [data-law], li').count()
log('§3.7.e bankruptcy laws list', lawsRender > 0 ? 'PASS' : 'FAIL', `items=${lawsRender}`)

// ===== §3.7.f Stručni Radovi =====
await goto('/hr/stecaj/strucni-radovi')
const fHeadings = await pageRenderedCount(1)
const fItems = await page.locator('article, a[href*="strucni-radovi/"], li').count()
log('§3.7.f professional works page exists', fHeadings ? 'PASS' : 'FAIL', `url=${page.url().replace(BASE,'')}`)
log('§3.7.f professional works list', fItems > 0 ? 'PASS' : 'FAIL', `items=${fItems}`)
const fSel = await countSelects()
log('§3.7.f.2 inherits §3.7.2 search bar', fSel >= 6 ? 'PASS' : 'FAIL', `selects=${fSel}`)

// ===== §3.7.g International Exchange =====
await goto('/hr/stecaj/internacionalno')
const gHeadings = await pageRenderedCount(1)
const gItems = await page.locator('article, a[href*="internacionalno/"], li').count()
log('§3.7.g international exchange page exists', gHeadings ? 'PASS' : 'FAIL', `url=${page.url().replace(BASE,'')}`)
log('§3.7.g international exchange list', gItems > 0 ? 'PASS' : 'FAIL', `items=${gItems}`)

// ===== §3.7.h Judicial Practice search =====
await goto('/hr/stecaj/odluke')
const hCriteriaPlace = await findPlaceholder('kriterij') || await findPlaceholder('pretra')
const hSel = await countSelects()
log('§3.7.h judicial practice search input', hCriteriaPlace ? 'PASS' : 'FAIL', `placeholder=${hCriteriaPlace||'NONE'}`)
log('§3.7.h judicial practice has dropdowns (zbirka/registry)', hSel >= 2 ? 'PASS' : 'FAIL', `selects=${hSel}`)

await browser.close()

const pass = results.filter(r => r.status === 'PASS').length
const fail = results.filter(r => r.status === 'FAIL').length
console.log(`\n=== §3.7 SUMMARY: ${pass} PASS, ${fail} FAIL (total ${results.length}) ===\n`)
console.log('=== FAIL detail ===')
for (const r of results.filter(r => r.status === 'FAIL')) console.log(`  ${r.key} — ${r.note}`)
