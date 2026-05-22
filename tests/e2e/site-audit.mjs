#!/usr/bin/env node
/**
 * Consolidated end-to-end audit — drives a real headless browser through
 * every important public, admin, and editor page, plus separate probes for
 * security headers + path-leak surface. Outputs a triaged JSON report on
 * stdout (findings grouped by severity: error / warn / info).
 *
 * Usage:
 *   AUDIT_EMAIL=... AUDIT_PASSWORD=... node site-audit.mjs
 */
import { chromium } from 'playwright'

// Default to the host nginx (port 80) — that's what external visitors hit and
// is where security headers + secret-path denials are actually enforced.
// Set BASE_URL=http://127.0.0.1:4092 to probe the docker container instead.
const BASE = process.env.BASE_URL || 'http://127.0.0.1:80'
const EMAIL = process.env.AUDIT_EMAIL || '_audit_test@sudacka-mreza.local'
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditTest!2026.05.22'

const findings = []
const add = (severity, area, page, msg, ext) => findings.push({ severity, area, page, msg, ...(ext ? { ext } : {}) })

// ─── 1. Page list ────────────────────────────────────────────────────────
const PUBLIC = [
  '/', '/hr',
  // about / contact / policies
  '/hr/o-nama', '/hr/kontakt', '/hr/uvjeti', '/hr/privatnost', '/hr/kolacici',
  // services
  '/hr/usluge', '/hr/dokumenti', '/hr/dokumenti/generator',
  '/hr/pristojbe', '/hr/pravna-pomoc', '/hr/rokovi',
  // judiciary
  '/hr/sudovi', '/hr/sudovi/suci',
  '/hr/sudovi/nadleznost',
  '/hr/mapa',  // map of courts
  '/hr/strucnjaci/vjestaci', '/hr/strucnjaci/tumaci',
  '/hr/dorh',
  // decisions
  '/hr/sudska-praksa', '/hr/sudska-praksa/pretraga',
  '/hr/sudska-praksa/vts', '/hr/sudska-praksa/esljp',
  '/hr/sudska-praksa/ecj',
  // bankruptcy
  '/hr/stecaj', '/hr/stecaj/oglasi', '/hr/stecaj/duznici',
  '/hr/stecaj/upravitelji', '/hr/stecaj/zakoni', '/hr/stecaj/odluke',
  // misc
  '/hr/vijesti', '/hr/galerije', '/hr/statistika',
  '/hr/pracenje', '/hr/api',
  // auth
  '/hr/prijava', '/hr/registracija', '/hr/zaboravljena-lozinka',
  // EN parity sample
  '/en', '/en/courts', '/en/about',
]

const ADMIN = [
  '/hr/admin', '/hr/admin/users', '/hr/admin/gdpr',
  '/hr/admin/bankruptcy', '/hr/admin/filings',
  '/hr/admin/flags', '/hr/admin/news', '/hr/admin/media',
  '/hr/admin/audit-log',
  '/hr/admin/courts', '/hr/admin/judges',
  '/hr/admin/experts', '/hr/admin/interpreters',
  '/hr/admin/state-attorneys', '/hr/admin/bankruptcy-administrators',
  '/hr/admin/bankruptcy-debtors', '/hr/admin/bankruptcy-filings',
  '/hr/admin/laws', '/hr/admin/legal-categories',
  '/hr/admin/documents', '/hr/admin/pages',
  '/hr/admin/api-keys', '/hr/admin/globals',
]

const EDITOR = [
  '/hr/editor', '/hr/editor/ingest', '/hr/editor/pending',
  '/hr/editor/bankruptcy',
]

const SECRET_PATHS = [
  '/.env', '/.git/HEAD', '/.git/config', '/package.json',
  '/package-lock.json', '/pnpm-lock.yaml', '/yarn.lock',
  '/.DS_Store', '/tsconfig.json', '/vite.config.ts',
  '/.svn/entries', '/web.config', '/.htaccess', '/config.json',
]

// ─── 2. Helpers ──────────────────────────────────────────────────────────

async function probePage(page, url, label, { allowConsoleErrors = false } = {}) {
  const errs = []
  const warns = []
  const reqFails = []
  const consoleListener = (msg) => {
    if (msg.type() === 'error') errs.push(msg.text().slice(0, 250))
    if (msg.type() === 'warning') warns.push(msg.text().slice(0, 250))
  }
  const reqFailedListener = (req) => {
    if (req.url().startsWith(BASE)) reqFails.push(`${req.method()} ${req.url().slice(BASE.length)} :: ${req.failure()?.errorText}`)
  }
  page.on('console', consoleListener)
  page.on('requestfailed', reqFailedListener)

  let response
  try {
    response = await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 20000 })
  } catch (e) {
    add('error', 'FUNC', url, `goto failed: ${e.message.split('\n')[0]}`)
    page.off('console', consoleListener)
    page.off('requestfailed', reqFailedListener)
    return null
  }

  if (!response || response.status() >= 500) {
    add('error', 'FUNC', url, `HTTP ${response?.status() ?? 'none'}`)
  } else if (response.status() >= 400) {
    add('error', 'FUNC', url, `HTTP ${response.status()}`)
  }

  // a11y / functional spot checks (independent of HTTP status, since SPA
  // returns 200 for unknown routes)
  await page.waitForTimeout(300)

  // 1. <html lang>
  const lang = await page.locator('html').getAttribute('lang')
  if (!lang || lang.length > 5 || !/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) {
    add('warn', 'WCAG', url, `html lang="${lang}" not a valid BCP-47 short code`)
  }

  // 2. <title>
  const title = (await page.title()).trim()
  if (!title) add('warn', 'WCAG', url, 'page <title> empty')
  else if (title.length < 5) add('info', 'WCAG', url, `page <title> very short: "${title}"`)

  // 3. exactly one <h1>
  const h1Count = await page.locator('h1').count()
  if (h1Count === 0) add('warn', 'WCAG', url, 'no <h1> on page')
  else if (h1Count > 1) add('info', 'WCAG', url, `${h1Count} <h1> elements (expected 1)`)

  // 4. images without alt
  const imgsNoAlt = await page.evaluate(() => {
    return Array.from(document.images)
      .filter((i) => !i.hasAttribute('alt') && !i.closest('[role="presentation"]'))
      .map((i) => i.src).slice(0, 5)
  })
  if (imgsNoAlt.length) {
    add('warn', 'WCAG', url, `${imgsNoAlt.length} <img> without alt attr (first: ${imgsNoAlt[0]?.slice(-60)})`)
  }

  // 5. unlabeled form controls
  const unlabeled = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
      .filter((el) => {
        const t = el.getAttribute('type')
        if (t === 'hidden' || t === 'submit' || t === 'button') return false
        if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder')) return false
        const id = el.id
        if (id && document.querySelector(`label[for="${id}"]`)) return false
        if (el.closest('label')) return false
        return true
      })
      .map((el) => `${el.tagName.toLowerCase()}${el.name ? `[name=${el.name}]` : ''}`)
    return inputs.slice(0, 5)
  })
  if (unlabeled.length) add('warn', 'WCAG', url, `unlabeled form controls: ${unlabeled.join(', ')}`)

  // 6. skip link
  const skipLink = await page.locator('a.skip-link, a[href^="#main"]').first().count()
  if (!skipLink) add('info', 'WCAG', url, 'no skip-to-content link detected')

  // 7. console errors (excluding well-known noise)
  const realErrs = errs.filter((e) =>
    !/manifest\.json/i.test(e) &&
    !/favicon/i.test(e) &&
    !/ResizeObserver loop/i.test(e) &&
    !/^Failed to load resource: the server responded with a status of 401/.test(e)
  )
  if (realErrs.length && !allowConsoleErrors) {
    add('error', 'FUNC', url, `${realErrs.length} console.error during load`, realErrs.slice(0, 3))
  }

  // 8. failed network requests
  const realFails = reqFails.filter((r) =>
    !/favicon|robots\.txt|sitemap\.xml/i.test(r),
  )
  if (realFails.length) {
    add('error', 'FUNC', url, `${realFails.length} failed sub-resource requests`, realFails.slice(0, 3))
  }

  page.off('console', consoleListener)
  page.off('requestfailed', reqFailedListener)
  return response
}

// ─── 3. Run ──────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'hr-HR',
})
const page = await ctx.newPage()

console.error('\n=== PUBLIC PAGES ===')
for (const url of PUBLIC) {
  console.error(`  ${url}`)
  await probePage(page, url, 'public')
}

console.error('\n=== SECURITY: response headers on / ===')
{
  const resp = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const h = resp?.headers() ?? {}
  const expect = [
    ['x-frame-options', 'DENY|SAMEORIGIN'],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', '.+'],
    ['permissions-policy', '.+'],
    ['content-security-policy', '.+'],
  ]
  for (const [name, pat] of expect) {
    const v = h[name] ?? h[name.toLowerCase()]
    if (!v) add('warn', 'PEN', '/', `missing response header: ${name}`)
    else if (!new RegExp(pat, 'i').test(v)) add('info', 'PEN', '/', `${name}=${v.slice(0, 80)} (consider ${pat})`)
  }
}

console.error('\n=== SECURITY: secret path leaks ===')
for (const p of SECRET_PATHS) {
  const r = await page.context().request.get(BASE + p)
  if (r.status() < 400) {
    add('error', 'PEN', p, `secret path returns HTTP ${r.status()}`)
  }
}

console.error('\n=== GDPR / cookie consent on / ===')
{
  await ctx.clearCookies()
  await page.goto(BASE + '/hr', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const consentVisible = await page.locator('[role="dialog"][aria-label*="kolač" i], [aria-label*="cookie" i], [data-testid*="cookie-consent"], button:has-text("Prihvati")').first().isVisible().catch(() => false)
  if (!consentVisible) add('warn', 'GDPR', '/hr', 'no cookie consent banner visible on first visit')

  // Check no third-party analytics / fingerprinting requests fired before consent
  // (we'd need a request-spy; spot-check by looking at outbound hostnames from page).
  const outbound = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map((s) => s.src).filter(Boolean)
    return scripts.filter((s) => !s.includes(location.host))
  })
  if (outbound.length) {
    add('warn', 'GDPR', '/hr', `third-party scripts loaded before consent: ${outbound.slice(0, 3).join(', ')}`)
  }
}

console.error('\n=== AUTH: log in as test admin ===')
{
  await page.goto(BASE + '/hr/prijava', { waitUntil: 'networkidle' })
  // Login form uses id="login-email" (type=text — supports email-or-username)
  // and id="login-password". Don't rely on type=email.
  await page.fill('#login-email', EMAIL).catch(async () => {
    add('error', 'FUNC', '/hr/prijava', 'email/username field (#login-email) not findable')
  })
  await page.fill('#login-password', PASSWORD).catch(async () => {
    add('error', 'FUNC', '/hr/prijava', 'password field (#login-password) not findable')
  })
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)
  const url = page.url()
  if (url.includes('/prijava')) {
    const bodyText = (await page.locator('body').textContent() ?? '').slice(0, 400)
    add('error', 'AUTH', '/hr/prijava', `login did not navigate away; body excerpt: ${bodyText}`)
  } else {
    add('info', 'AUTH', '/hr/prijava', `logged in OK; landed on ${url.replace(BASE, '')}`)
  }
}

console.error('\n=== ADMIN PAGES (authed) ===')
for (const url of ADMIN) {
  console.error(`  ${url}`)
  await probePage(page, url, 'admin', { allowConsoleErrors: true })
}

console.error('\n=== EDITOR PAGES (authed) ===')
for (const url of EDITOR) {
  console.error(`  ${url}`)
  await probePage(page, url, 'editor', { allowConsoleErrors: true })
}

await browser.close()

// ─── 4. Output report ────────────────────────────────────────────────────
const summary = {
  total: findings.length,
  errors: findings.filter((f) => f.severity === 'error').length,
  warns: findings.filter((f) => f.severity === 'warn').length,
  infos: findings.filter((f) => f.severity === 'info').length,
}
console.log(JSON.stringify({ base: BASE, summary, findings }, null, 2))
console.error(`\n=== SUMMARY: ${summary.errors} errors, ${summary.warns} warns, ${summary.infos} infos ===`)
