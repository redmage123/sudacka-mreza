#!/usr/bin/env node
/**
 * One-time interactive admin login — opens a real browser, navigates to
 * /hr/login, then pauses so you can type your email + password + OTP.
 * Once you reach /hr/admin, hit Resume in Playwright Inspector (or
 * close the browser) and we save the auth cookies to .admin-state.json
 * for headless reuse by screenshot-admin-fixes.mjs.
 *
 *   node tests/e2e/admin-login.mjs                       # default base
 *   BASE_URL=http://localhost:4092 node tests/e2e/...    # local
 *
 * Output: tests/e2e/.admin-state.json (gitignored).
 */
import { chromium } from 'playwright'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://23.164.48.64'
const STATE_FILE = join(import.meta.dirname || '.', '.admin-state.json')

console.log(`base: ${BASE}`)
console.log(`state will be saved to: ${STATE_FILE}`)
console.log(`After you log in and land on /hr/admin, the script will save and exit.`)

const browser = await chromium.launch({ headless: false })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
})
const page = await ctx.newPage()

await page.goto(`${BASE}/hr/login`)

// Wait until URL contains /admin (after MFA completes the redirect).
console.log('Waiting for you to log in...')
await page.waitForURL(/\/admin/, { timeout: 5 * 60 * 1000 })  // 5 min max
console.log('Detected /admin landing — saving auth state...')

await ctx.storageState({ path: STATE_FILE })
console.log(`Saved to ${STATE_FILE}`)
await browser.close()
