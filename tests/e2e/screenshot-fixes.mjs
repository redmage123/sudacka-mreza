#!/usr/bin/env node
/**
 * Screenshot every fix landed in the recent session — labels, detail
 * pages, hybrid search, calculator references, admin UX, login reset.
 *
 * Usage:
 *   node tests/e2e/screenshot-fixes.mjs                 # default base = live external IP
 *   BASE_URL=http://localhost:4092 node ...             # local container
 *   OUT_DIR=docs/screenshots/2026-06-02 node ...        # dated subdir
 *
 * Writes PNGs to docs/screenshots/<date>/NN-<slug>.png. Each shot is
 * full-page at 1440x900 viewport. Steps that need an interaction (e.g.
 * click row to open admin edit form) run that interaction first.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://23.164.48.64'
const today = new Date().toISOString().slice(0, 10)
const OUT_DIR = process.env.OUT_DIR || `docs/screenshots/${today}`

mkdirSync(OUT_DIR, { recursive: true })

// Each step: {file, url, label, wait?, action?, fullPage?}
// wait: extra ms after navigation (for client-side React render)
// action: async (page) => {} called after navigation but before shot
const SHOTS = [
  { file: '01-homepage-hr',                url: '/hr',                                   label: 'Homepage (HR) — inline search form + Mediji nav group' },
  { file: '02-homepage-en',                url: '/en',                                   label: 'Homepage (EN)' },

  { file: '03-judges-list',                url: '/hr/sudovi/suci',                       label: 'Judges list — clickable cards + Pogledaj detalje CTA' },
  { file: '04-judge-detail',               url: '/hr/sudovi/suci/7277',                  label: 'Judge detail — Court (linked) + Status badge + Specialization + Appointment Date cards (—) for nulls' },
  { file: '05-judges-search',              url: '/hr/sudovi/suci?q=Ante',                label: 'Judges hybrid search results' },

  { file: '06-experts-list',               url: '/hr/strucnjaci/vjestaci',               label: 'Expert witnesses — 2,653 entries with specialty areas' },
  { file: '07-expert-detail',              url: '/hr/strucnjaci/vjestaci/1',             label: 'Expert detail page' },
  { file: '08-experts-search',             url: '/hr/strucnjaci/vjestaci?q=forenzika',   label: 'Experts semantic search (specialty area)' },

  { file: '09-interpreters-list',          url: '/hr/strucnjaci/tumaci',                 label: 'Interpreters — 2,253 entries with language pairs' },
  { file: '10-interpreter-detail',         url: '/hr/strucnjaci/tumaci/1',               label: 'Interpreter detail page' },
  { file: '11-interpreters-search',        url: '/hr/strucnjaci/tumaci?q=engleski',      label: 'Interpreters search (language)' },

  { file: '12-state-attorneys-list',       url: '/hr/sudovi/dorh',                       label: 'State attorneys — clickable cards + Pogledaj detalje (NEW)' },
  { file: '13-state-attorney-detail',      url: '/hr/sudovi/dorh/1',                     label: 'State attorney detail page (NEW)' },

  { file: '14-bankruptcy-admins-list',     url: '/hr/stecaj/upravitelji',                label: 'Bankruptcy admins — License Number + City + details column (NEW)' },
  { file: '15-admin-detail',               url: '/hr/stecaj/upravitelji/1',              label: 'Bankruptcy admin detail page — License Number, OIB, Address, City, Courts (NEW)' },

  { file: '16-bankruptcy-listings',        url: '/hr/stecaj/oglasi',                     label: 'Bankruptcy listings — debtor/court/admin/status filter row' },
  { file: '17-bankruptcy-debtors',         url: '/hr/stecaj/duznici',                    label: 'Debtors list — own page per debtor' },
  { file: '18-bankruptcy-laws',            url: '/hr/stecaj/zakoni',                     label: 'Bankruptcy laws — 18 acts seeded' },
  { file: '19-bankruptcy-portal-cta',      url: '/hr/stecaj',                            label: 'Bankruptcy portal — Submit a filing CTA' },

  { file: '20-courts-list',                url: '/hr/sudovi',                            label: 'Courts list — renders departments + jurisdictionArea' },
  { file: '21-court-detail',               url: '/hr/sudovi/1',                          label: 'Court detail — timeAvailability, jurisdiction GeoJSON' },

  { file: '22-calculator-nn',              url: '/hr/kalkulator',                        label: 'Sudske pristojbe calculator — NN 118/18 Tarifni broj reference link',
    action: async (page) => { try { await page.fill('input[type="number"]', '100000') } catch {} } },

  { file: '23-media-audio',                url: '/hr/mediji/audio',                      label: 'Mediji — Audio Galleries (NEW)' },
  { file: '24-media-video',                url: '/hr/mediji/video',                      label: 'Mediji — Video Galleries (NEW)' },
  { file: '25-media-press',                url: '/hr/mediji/press',                      label: 'Mediji — Press Clipping (NEW)' },

  { file: '26-login-clean',                url: '/hr/login',                             label: 'Login — email/password form (clean state)' },

  { file: '27-admin-dashboard',            url: '/hr/admin',                             label: 'Admin dashboard hub' },
  { file: '28-admin-judges-table',         url: '/hr/admin/judges',                      label: 'Admin: judges table — column headers via field labels (Title Case)' },
  { file: '29-admin-bankruptcy-admins',    url: '/hr/admin/bankruptcy-administrators',   label: 'Admin: bankruptcy admins — License Number column + OIB field' },

  { file: '30-pretraga',                   url: '/hr/pretraga',                          label: 'Global search page' },
]

console.log(`base: ${BASE}`)
console.log(`out:  ${OUT_DIR}`)
console.log(`shots: ${SHOTS.length}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
})
const page = await ctx.newPage()

const manifest = []
let ok = 0, fail = 0

for (const shot of SHOTS) {
  const url = BASE + shot.url
  const file = join(OUT_DIR, `${shot.file}.png`)
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    // Give React one more tick for hydration / data fetches.
    await page.waitForTimeout(800)
    if (shot.action) await shot.action(page)
    await page.screenshot({ path: file, fullPage: true })
    const status = resp ? resp.status() : 0
    console.log(`  ✓ ${shot.file}  [${status}]  ${shot.label.slice(0, 60)}`)
    manifest.push({ file: shot.file + '.png', url: shot.url, label: shot.label, status })
    ok++
  } catch (e) {
    console.log(`  ✗ ${shot.file}  ${e.message.slice(0, 80)}`)
    manifest.push({ file: shot.file + '.png', url: shot.url, label: shot.label, error: e.message })
    fail++
  }
}

await browser.close()

writeFileSync(
  join(OUT_DIR, 'manifest.json'),
  JSON.stringify({ base: BASE, generated: new Date().toISOString(), shots: manifest }, null, 2),
)

console.log(`\nDone — ${ok} ok, ${fail} failed. Output: ${OUT_DIR}/`)
