import { chromium } from 'playwright'
const BASE = 'http://23.164.48.64'
const b = await chromium.launch()
const c = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 1200 } })
const p = await c.newPage()

const r = await p.request.post(`${BASE}/api/users/auth/login`, {
  data: { username: 'drazen', password: 'Qqvz@tmG7JOLNYQPQqke' },
  headers: { 'Content-Type': 'application/json' },
})
const j = await r.json()
const token = j.token
console.log('login ok, role:', j.user?.role)

await p.addInitScript((t) => {
  try { localStorage.setItem('payload-token', t) } catch {}
}, token)
await c.addCookies([{ name: 'payload-token', value: token, domain: '23.164.48.64', path: '/' }])

await p.goto(`${BASE}/hr/admin`, { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
await p.screenshot({ path: '/tmp/admin_dashboard.png', fullPage: true })
console.log('dashboard URL:', p.url())

await p.goto(`${BASE}/hr/admin/bankruptcy-filings`, { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
await p.screenshot({ path: '/tmp/admin_filings.png', fullPage: true })
console.log('filings URL:', p.url())

// Outline the H1/H2 structure
const headings = await p.evaluate(() => {
  const out = []
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    out.push({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 100) })
  }
  return out
})
console.log('headings on filings page:')
console.log(JSON.stringify(headings, null, 2))

await b.close()
