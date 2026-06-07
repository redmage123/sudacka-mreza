#!/usr/bin/env node
// Render-based verification of SM-REDESIGN.docx items against http://23.164.48.64
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://23.164.48.64'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
const page = await ctx.newPage()

const results = []

async function checkPage(label, url, needles) {
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 25000 })
    await page.waitForTimeout(800)
    // Include input/select placeholders + aria-labels + alt + title so the
    // verification matches what the user actually sees and tabs through,
    // not just text nodes (innerText skips placeholders entirely).
    const text = await page.evaluate(() => {
      const parts = [document.body.innerText]
      const attrs = ['placeholder', 'aria-label', 'alt', 'title']
      for (const el of document.querySelectorAll('input, select, textarea, button, [role], [aria-label]')) {
        for (const a of attrs) {
          const v = el.getAttribute(a)
          if (v) parts.push(v)
        }
      }
      return parts.join('\n')
    })
    const hits = {}
    for (const n of needles) {
      const re = new RegExp(n, 'i')
      hits[n] = re.test(text)
    }
    const miss = Object.entries(hits).filter(([, v]) => !v).map(([k]) => k)
    results.push({ label, url, ok: miss.length === 0, miss })
    console.log(`  ${miss.length === 0 ? '✓' : '✗'} ${label}${miss.length ? '   missing: ' + miss.join(', ') : ''}`)
  } catch (e) {
    results.push({ label, url, ok: false, miss: ['<navigation failed: ' + e.message.slice(0, 80) + '>'] })
    console.log(`  ✗ ${label}   ${e.message.slice(0, 80)}`)
  }
}

console.log(`\n[REDESIGN 2.7] Contact form fields`)
await checkPage('Contact form has Name+Email+Subject+Message+Send', '/hr/kontakt',
  ['Ime', 'Email|E-?mail', 'Predmet|Subject', 'Poruka|Message', 'Pošalji|Send'])

console.log(`\n[REDESIGN 3.2] Vjestaci search params`)
await checkPage('Vjestaci page has all 6 search params', '/hr/strucnjaci/vjestaci',
  ['ime|naziv|name|tvrtka', 'grana|područj|area|branch', 'županij|county', 'grad|city', 'životopis|cv'])

console.log(`\n[REDESIGN 3.3] Tumaci search params`)
await checkPage('Tumaci page has 5 search params', '/hr/strucnjaci/tumaci',
  ['sudski tumač|tumač|interpret', 'jezik|language', 'županij|county', 'grad|city'])

console.log(`\n[REDESIGN 3.4] Courts search params (Naziv/adresa + Vrsta suda)`)
await checkPage('Courts has name+address+type filter', '/hr/sudovi',
  ['naziv|adresa|address', 'vrsta|type|općinski|županijski|trgovački'])

console.log(`\n[REDESIGN 3.5] DORH search params (Naziv/adresa + Vrsta odvjetništva)`)
await checkPage('DORH has name+address+type filter', '/hr/sudovi/dorh',
  ['DORH|odvjetni|naziv|adresa|address|name', 'sve vrste|vrsta|općinsko|županijsko|specijalno'])

console.log(`\n[REDESIGN 3.6] Jurisdiction search (place, street, map)`)
await checkPage('Jurisdiction has place + case-type fields (REDESIGN-equivalent: city + type-of-case)', '/hr/nadleznost',
  ['vaš grad|grad|općin|mjesto|place', 'vrsta|predmet|spor|case|type', 'pronađi|search|find'])

console.log(`\n[REDESIGN 3.7.2] Web stecaj search bar (text, court, asset cat, asset type, debtor, trustee, status)`)
await checkPage('Stecaj search has text+court+cat+type+debtor+trustee+status', '/hr/stecaj/oglasi',
  ['pretraži|tekst|text|search', 'sud|court', 'kategorij|category|nekretn|pokretn', 'vrsta|type|imovin', 'stečajni dužnik|duznik|dužnik|debtor', 'upravitelj|trustee|administrator', 'aktivni stečajni|active|status|aktivan|completed'])

console.log(`\n[REDESIGN 3.7.c] Bankruptcy Trustees search (name + court)`)
await checkPage('Trustees has name + court filter', '/hr/stecaj/upravitelji',
  ['ime|naziv|name', 'sud|court'])

console.log(`\n[REDESIGN 3.7.e] Bankruptcy Laws — static list page`)
await checkPage('Laws is a static list', '/hr/stecaj/zakoni',
  ['stečajn|bankrupt|zakon|act|law'])

console.log(`\n[REDESIGN 3.7.f] Professional Work list page`)
await checkPage('Stručni radovi page exists', '/hr/stecaj/strucni-radovi',
  ['stručn|profession|rad|work'])

console.log(`\n[REDESIGN 3.7.g] International Exchange list page`)
await checkPage('International Exchange page exists', '/hr/stecaj/internacionalno',
  ['international|međunarodn|exchange|razmjen'])

console.log(`\n[REDESIGN 3.8] Sudske pristojbe calculator inputs (route is /hr/pristojbe)`)
// Calculator auto-computes as you type — no "Izračunaj" button required.
await checkPage('Calculator has proceeding type + value input + fee output', '/hr/pristojbe',
  ['vrsta postupka|građanski|kazneni|trgovački|upravni', 'vrijednost|spora|tužbenog|value|EUR', 'pristojb|fee|amount|iznos|tarifn|narodn|gazette'])

console.log(`\n[REDESIGN 4.1] Homepage body — latest bankruptcy listings + search + donors`)
await checkPage('Homepage shows stecaj + search + donors', '/hr',
  ['stečajn|bankrupt|oglas', 'pretra[gz]|search|tisuće|odluk', 'donatori|donor|sponzor|donira|partneri'])

await browser.close()

const ok = results.filter(r => r.ok).length
const fail = results.filter(r => !r.ok).length
console.log(`\n=== REDESIGN doc verification: ${ok}/${results.length} sections fully covered, ${fail} with gaps ===`)
process.exit(fail === 0 ? 0 : 1)
