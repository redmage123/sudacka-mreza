// Live audit against NEDOSTACI doc + SM-REDESIGN spec + this session's gap list.
// Tests user-visible behavior on Toronto (23.164.48.64), NOT file existence.
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
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (e) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  }
  await page.waitForTimeout(1200)
}

async function countSelects() {
  return await page.locator('select, [role="combobox"]').count()
}
async function findPlaceholder(needle) {
  const inputs = await page.locator('input').elementHandles()
  for (const h of inputs) {
    const p = (await h.getAttribute('placeholder')) || ''
    if (p.toLowerCase().includes(needle.toLowerCase())) return p
  }
  return null
}
async function findLabelOrAria(needle) {
  const all = await page.locator('label, [aria-label]').elementHandles()
  const n = needle.toLowerCase()
  for (const h of all) {
    const text = ((await h.textContent()) || '').toLowerCase()
    const aria = ((await h.getAttribute('aria-label')) || '').toLowerCase()
    if (text.includes(n) || aria.includes(n)) return text || aria
  }
  return null
}
async function countText(regex) {
  return await page.locator(`text=${regex}`).count()
}

// ====================== NEDOSTACI ======================

// #3 Bankruptcy Filings admin page — fixed this session
await goto('/hr/admin/bankruptcy-filings')
const has404 = (await page.locator('text=/404|Not Found|Page not found|Stranica nije/i').count()) > 0
const hasTable = (await page.locator('table, [role="table"], button:has-text("Novi"), button:has-text("New")').count()) > 0
log('NED#3 admin bankruptcy-filings renders', (!has404 && hasTable) ? 'PASS' : 'FAIL',
  `404=${has404}, table/cta=${hasTable}`)

// #4a Vještaci search params
await goto('/hr/strucnjaci/vjestaci')
const vjSelects = await countSelects()
const vjCountyPh = await findPlaceholder('županij') || await findPlaceholder('county') || await findLabelOrAria('županij') || await findLabelOrAria('county')
const vjCityPh = await findPlaceholder('grad') || await findPlaceholder('city') || await findLabelOrAria('grad') || await findLabelOrAria('city')
const vjExpertPh = await findPlaceholder('područ') || await findPlaceholder('stručn') || await findPlaceholder('grana') || await findPlaceholder('expert') || await findLabelOrAria('grana') || await findLabelOrAria('područ') || await findLabelOrAria('specialit') || await findLabelOrAria('speciality')
log('NED#4 vještaci county filter present', (vjCountyPh || vjSelects >= 2) ? 'PASS' : 'FAIL', `placeholder=${vjCountyPh||'NONE'}`)
log('NED#4 vještaci city filter present', (vjCityPh || vjSelects >= 2) ? 'PASS' : 'FAIL', `placeholder=${vjCityPh||'NONE'}`)
log('NED#4 vještaci expertise filter present', vjExpertPh ? 'PASS' : 'FAIL', `placeholder=${vjExpertPh||'NONE'}`)
log('NED#4 vještaci uses dropdowns (≥3)', vjSelects >= 3 ? 'PASS' : 'FAIL', `<select>/combobox=${vjSelects}`)

// #4b Tumači search params
await goto('/hr/strucnjaci/tumaci')
const tuSelects = await countSelects()
const tuCountyPh = await findPlaceholder('županij') || await findPlaceholder('county') || await findLabelOrAria('županij') || await findLabelOrAria('county')
const tuCityPh = await findPlaceholder('grad') || await findPlaceholder('city') || await findLabelOrAria('grad') || await findLabelOrAria('city')
const tuLangPh = await findPlaceholder('jezik') || await findPlaceholder('lang') || await findLabelOrAria('jezik') || await findLabelOrAria('language')
log('NED#4 tumači county filter', (tuCountyPh || tuSelects >= 2) ? 'PASS' : 'FAIL', `placeholder=${tuCountyPh||'NONE'}`)
log('NED#4 tumači city filter', (tuCityPh || tuSelects >= 2) ? 'PASS' : 'FAIL', `placeholder=${tuCityPh||'NONE'}`)
log('NED#4 tumači language filter', tuLangPh ? 'PASS' : 'FAIL', `placeholder=${tuLangPh||'NONE'}`)
log('NED#4 tumači uses dropdowns (≥3)', tuSelects >= 3 ? 'PASS' : 'FAIL', `<select>/combobox=${tuSelects}`)

// #5 Sudovi departments + hours — visit a known populated court directly.
await goto('/hr/sudovi/3')
await page.waitForTimeout(2000)
{
  const depHeading = await countText('/odjel/i')
  const depRows = await countText('/pisarnica|tajnik|glasnogovornik|predsjedni/i')
  log('NED#5 court departments rendered',
    (depHeading > 0 && depRows > 0) ? 'PASS' : 'FAIL',
    `heading=${depHeading}, rows=${depRows}`)
  const opHrs = await countText('/radno vrijeme|operating hours/i')
  const stranke = await countText('/za stranke|public service|client service/i')
  log('SESSION#11 court operating hours', opHrs > 0 ? 'PASS' : 'FAIL', `mentions=${opHrs}`)
  log('SESSION#11 court public-service hours', stranke > 0 ? 'PASS' : 'FAIL', `mentions=${stranke}`)
  const courtCounty = await countText('/županija/i')
  const courtCity = await countText('/grad/i')
  log('SESSION#2 court county rendered', courtCounty > 0 ? 'PASS' : 'FAIL', `mentions=${courtCounty}`)
  log('SESSION#3 court city rendered', courtCity > 0 ? 'PASS' : 'FAIL', `mentions=${courtCity}`)
}

// #6 Suci — court affiliation rendered
await goto('/hr/sudovi/suci')
const judgeCourtMentions = await countText('/op[čć]inski sud|[žz]upanijski sud|trgova[čć]ki sud|vrhovni sud|primarni sud|assigned court/i')
const judgeListItems = await countText('/sudac|judge|sutkinja/i')
log('NED#6 suci court affiliation visible', judgeCourtMentions > 0 ? 'PASS' : 'FAIL',
  `mentions=${judgeCourtMentions}, list-context=${judgeListItems}`)

// #2 Stečajni upravitelji court affiliation
await goto('/hr/stecaj/upravitelji')
const upravFirst = page.locator('a[href*="/upravitelji/"]').first()
if (await upravFirst.count() > 0) {
  await upravFirst.click().catch(() => {})
  await page.waitForTimeout(2000)
  const adminCourt = await countText('/sud:|pripadnost sud|assigned court|dodijeljeni sud/i')
  log('NED#2 upravitelji court affiliation', adminCourt > 0 ? 'PASS' : 'FAIL', `mentions=${adminCourt}`)
} else {
  log('NED#2 upravitelji list', 'FAIL', 'no admin links')
}

// #1 Bankruptcy debtors detail page
await goto('/hr/stecaj/duznici')
const debFirst = page.locator('a[href*="/duznici/"]').first()
if (await debFirst.count() > 0) {
  await debFirst.click().catch(() => {})
  await page.waitForTimeout(2000)
  const ogl = await countText('/oglas|case|stečajn/i')
  log('NED#1 debtor detail + cases', ogl > 1 ? 'PASS' : 'FAIL', `case-related mentions=${ogl}`)
} else {
  log('NED#1 debtor list', 'FAIL', 'no debtor links')
}

// #8 Admin Croatian localization
await goto('/hr/admin')
await page.waitForTimeout(2000)
const enLeak = await page.locator('text=/^Dashboard$|^Users$|^Bankruptcy filings$|^Bankruptcy listings$|^Courts$|^Judges$|^Experts$|^Interpreters$/').count()
const hrPresent = await page.locator('text=/Nadzorna|Korisnici|Stečajni|Sudovi|Suci|Vještaci|Tumači/').count()
log('NED#8 admin nav Croatian', (hrPresent > 3 && enLeak === 0) ? 'PASS' : 'FAIL',
  `HR markers=${hrPresent}, EN leaks=${enLeak}`)

// ====================== SM-REDESIGN ======================

// §3.5 State Attorneys type filter
await goto('/hr/sudovi/dorh')
const saSelects = await countSelects()
log('REDESIGN §3.5 state-attorneys type filter', saSelects > 0 ? 'PASS' : 'FAIL', `selects=${saSelects}`)

// ====================== SESSION GAP LIST ======================

// Expert detail page: working hours, education, expert type, CV link, languages
await goto('/hr/strucnjaci/vjestaci')
const vjDetailFirst = page.locator('a[href*="/vjestaci/"]').first()
if (await vjDetailFirst.count() > 0) {
  await vjDetailFirst.click().catch(() => {})
  await page.waitForTimeout(2000)
  const wh = await countText('/radno vrijeme|working hours/i')
  const edu = await countText('/obrazovan|education|stručna sprema|VSS|VŠS|magist|doktor/i')
  const typ = await countText('/vrsta vještaka|expert type|stalni sudski|sworn court/i')
  const cv = await countText('/CV|životopis/i')
  log('SESSION#4 expert working hours', wh > 0 ? 'PASS' : 'FAIL', `mentions=${wh}`)
  log('SESSION#5 expert education level', edu > 0 ? 'PASS' : 'FAIL', `mentions=${edu}`)
  log('SESSION#6 expert type', typ > 0 ? 'PASS' : 'FAIL', `mentions=${typ}`)
  log('SESSION#8 expert CV link', cv > 0 ? 'PASS' : 'FAIL', `mentions=${cv}`)
}

// Interpreter detail: working hours, CV, multiple languages
await goto('/hr/strucnjaci/tumaci')
const tuDetailFirst = page.locator('a[href*="/tumaci/"]').first()
if (await tuDetailFirst.count() > 0) {
  await tuDetailFirst.click().catch(() => {})
  await page.waitForTimeout(2000)
  const wh = await countText('/radno vrijeme|working hours/i')
  const cv = await countText('/CV|životopis/i')
  log('SESSION#4 interpreter working hours', wh > 0 ? 'PASS' : 'FAIL', `mentions=${wh}`)
  log('SESSION#8 interpreter CV link', cv > 0 ? 'PASS' : 'FAIL', `mentions=${cv}`)
}

await browser.close()

const pass = results.filter(r => r.status === 'PASS').length
const fail = results.filter(r => r.status === 'FAIL').length
console.log(`\n=== SUMMARY: ${pass} PASS, ${fail} FAIL (total ${results.length}) ===\n`)
console.log('=== FAIL detail ===')
for (const r of results.filter(r => r.status === 'FAIL')) {
  console.log(`  ${r.key} — ${r.note}`)
}
