import { chromium } from 'playwright'
const BASE = 'http://23.164.48.64'
const b = await chromium.launch()
const c = await b.newContext({ ignoreHTTPSErrors: true })
const p = await c.newPage()
const errors = []
p.on('pageerror', e => errors.push(`PAGEERR: ${e.message}`))
p.on('console', m => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`) })
p.on('requestfailed', r => errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`))

// Login as Drazen (2FA-bypassed)
const r = await p.request.post(`${BASE}/api/users/auth/login`, {
  data: { username: 'drazen', password: 'Qqvz@tmG7JOLNYQPQqke' },
  headers: { 'Content-Type': 'application/json' },
})
const j = await r.json().catch(() => null)
console.log('login status:', r.status(), 'mfaRequired:', j?.mfaRequired, 'has token:', !!j?.token, 'role:', j?.user?.role)
if (!j?.token) { console.log(JSON.stringify(j)); process.exit(1) }

// Plant token as a cookie + localStorage
await c.addCookies([{ name: 'payload-token', value: j.token, domain: '23.164.48.64', path: '/' }])
await p.addInitScript((t) => { try { localStorage.setItem('payload-token', t) } catch {} }, j.token)

await p.goto(`${BASE}/hr/admin/bankruptcy-filings`, { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)

const tableCount = await p.locator('table').count()
const buttonCount = await p.locator('button').count()
const h1 = await p.locator('h1, h2, [class*="title"]').first().textContent().catch(() => '')
const bodyTxt = (await p.locator('main, body').first().textContent().catch(() => '')) || ''
console.log(`tables=${tableCount}, buttons=${buttonCount}, title="${(h1||'').slice(0,80)}"`)
console.log(`body snippet: "${bodyTxt.replace(/\s+/g,' ').slice(0,300)}"`)

// Try to find what is/isn't rendered
const noConfig = bodyTxt.toLowerCase().includes('unknown collection') || bodyTxt.toLowerCase().includes('no config')
const loaderOnly = bodyTxt.length < 100
console.log(`unknown-collection-text=${noConfig}, very-short-body=${loaderOnly}`)

console.log('\n--- errors observed ---')
for (const e of errors.slice(0, 20)) console.log(e)

await p.screenshot({ path: '/tmp/filings_debug.png', fullPage: true })
console.log('\nscreenshot: /tmp/filings_debug.png')
await b.close()
