#!/usr/bin/env node
// Playwright-stealth EUR-Lex full-text fetcher.
//
// EUR-Lex's web front-end now sits behind AWS WAF, which serves an HTTP 202
// JS challenge to plain `fetch()`. A real browser passes the challenge once
// per session by executing the AWS WAF JavaScript and storing the cookie.
// We use playwright-extra + stealth so the challenge actually completes.
//
// Strategy:
//   - One persistent BrowserContext per language (so the WAF cookie sticks)
//   - Concurrency = 1 per browser; spawn N browsers if you need parallelism
//   - 4–9 s human-shaped jitter between requests
//   - Resumable: skips celex×lang already in corpus.jsonl
//   - Bail+long-back-off on any captcha re-challenge
//
// Reads the CELEX index produced by eurlex-corpus.mjs --phase=discover.
// Writes one JSONL line per (celex, lang) into corpus.jsonl.
//
// Usage (run on the pod for bandwidth):
//   node eurlex-fetch-stealth.mjs --index=/workspace/eurlex/index.csv \
//        --out=/workspace/eurlex/corpus.jsonl --langs=en --max=5000
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

const argv = process.argv.slice(2)
const getArg = (n, dflt) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`))
  return a ? a.split('=')[1] : dflt
}
const INDEX = getArg('index', '/workspace/eurlex/index.csv')
const OUT = getArg('out', '/workspace/eurlex/corpus.jsonl')
const LANGS = getArg('langs', 'en').split(',')
const MAX = parseInt(getArg('max', '5000'), 10)
const HEADFUL = argv.includes('--headful')
const DEBUG = argv.includes('--debug')

const REAL_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const jitter = (lo, hi) => sleep(lo + Math.random() * (hi - lo))
const log = (...a) => console.log(new Date().toISOString(), ...a)

function loadIndex() {
  const lines = fs.readFileSync(INDEX, 'utf8').split('\n').slice(1).filter(Boolean)
  return lines.map((l) => {
    const [celex, date] = l.split(',')
    return { celex, date }
  })
}

function loadResume() {
  const seen = new Set()
  if (!fs.existsSync(OUT)) return seen
  for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) {
    try {
      const o = JSON.parse(l)
      if (o.celex && o.lang) seen.add(`${o.celex}:${o.lang}`)
    } catch {
      /* skip */
    }
  }
  return seen
}

async function detectChallenge(page) {
  const title = (await page.title().catch(() => '')) || ''
  if (/just a moment|captcha|verify|attention required|access denied/i.test(title)) {
    return `title="${title}"`
  }
  const html = await page.content().catch(() => '')
  if (
    /awsWafCookieDomainList|gokuProps|cf-challenge|hcaptcha|g-recaptcha/i.test(html) ||
    /id="challenge-container"/i.test(html)
  ) {
    return 'aws-waf-or-similar'
  }
  return null
}

async function fetchOne(page, celex, lang) {
  const url = `https://eur-lex.europa.eu/legal-content/${lang.toUpperCase()}/TXT/?uri=CELEX:${celex}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await jitter(800, 1600)
  // Brief human cadence.
  try {
    await page.mouse.move(200 + Math.random() * 400, 250 + Math.random() * 300)
    await page.evaluate(() =>
      window.scrollBy({ top: 300 + Math.random() * 400, behavior: 'smooth' }),
    )
    await jitter(500, 900)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  } catch {
    /* page may have navigated */
  }

  const ch = await detectChallenge(page)
  if (ch) {
    return { error: `challenge:${ch}` }
  }

  // The legal-content servlet's main body sits in #document1 or, for
  // legislation, #PP1Contents/#PP2Contents. Pull the broadest match and
  // strip nav/aside.
  const text = await page.evaluate(() => {
    const main =
      document.querySelector('#document1') ||
      document.querySelector('#PP1Contents') ||
      document.querySelector('main') ||
      document.body
    if (!main) return ''
    // Remove nav/aside/script/style nodes.
    main
      .querySelectorAll('script,style,nav,aside,header,footer,.eli-tools,.tools')
      .forEach((n) => n.remove())
    return main.innerText.replace(/\s+/g, ' ').trim()
  })
  return { text: (text || '').slice(0, 800000) }
}

async function main() {
  const all = loadIndex()
  const seen = loadResume()
  log(`index=${all.length} resume=${seen.size} target_langs=${LANGS.join(',')} max=${MAX}`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const fd = fs.openSync(OUT, 'a')

  for (const lang of LANGS) {
    log(`=== language=${lang} ===`)
    const browser = await chromium.launch({
      headless: !HEADFUL,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    const ctx = await browser.newContext({
      userAgent: REAL_UA,
      viewport: { width: 1440, height: 900 },
      locale: lang === 'hr' ? 'hr-HR' : 'en-US',
      timezoneId: 'Europe/Brussels',
      extraHTTPHeaders: {
        'Accept-Language': lang === 'hr' ? 'hr-HR,hr;q=0.9' : 'en-GB,en-US;q=0.9,en;q=0.8',
        'sec-ch-ua': '"Not.A/Brand";v="99", "Chromium";v="128", "Google Chrome";v="128"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
      },
    })
    const page = await ctx.newPage()

    // Warmup: hit homepage, let WAF set cookie, idle a moment.
    try {
      await page.goto('https://eur-lex.europa.eu/', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await jitter(2500, 5000)
      const c = await detectChallenge(page)
      if (c) {
        log(`! warmup challenge (${c}) — waiting 30s`)
        await sleep(30000)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await jitter(3000, 5000)
      }
    } catch (e) {
      log(`! warmup goto failed: ${String(e.message).slice(0, 80)}`)
    }

    let written = 0
    let consecutiveChallenges = 0
    for (const row of all) {
      if (written >= MAX) break
      const k = `${row.celex}:${lang}`
      if (seen.has(k)) continue
      try {
        const r = await fetchOne(page, row.celex, lang)
        if (r.error) {
          consecutiveChallenges += 1
          log(`! ${row.celex} ${r.error}`)
          if (consecutiveChallenges >= 3) {
            log(`!! ${consecutiveChallenges} consecutive challenges — sleeping 10 min`)
            await sleep(600000)
            consecutiveChallenges = 0
          }
          continue
        }
        consecutiveChallenges = 0
        if (r.text && r.text.length >= 500) {
          fs.writeSync(
            fd,
            JSON.stringify({ celex: row.celex, lang, date: row.date, text: r.text }) + '\n',
          )
          written += 1
          if (written % 25 === 0) log(`  ${lang}: written=${written}`)
        }
      } catch (e) {
        log(`  ! ${row.celex}: ${String(e.message).slice(0, 100)}`)
      }
      await jitter(4000, 9000)
    }
    log(`lang=${lang} written=${written}`)
    await ctx.close()
    await browser.close()
  }

  fs.closeSync(fd)
  log('done')
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
