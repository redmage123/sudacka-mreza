/**
 * scraper.ts — Sudačka Mreža data-migration scraper
 *
 * Crawls http://sudacka-mreza.hr (ASP.NET WebForms) using node-fetch for
 * HTTP requests and cheerio for HTML-table parsing.  ASP.NET postback
 * pagination is handled by extracting the hidden __VIEWSTATE,
 * __VIEWSTATEGENERATOR and __EVENTVALIDATION fields and POST-ing them back.
 *
 * Usage:
 *   npx tsx src/migration/migrate.ts scrape
 *   npm run migrate:scrape
 *
 * Env vars (all optional):
 *   SCRAPE_BASE_URL   default: http://sudacka-mreza.hr
 *   SCRAPE_DELAY_MS   ms to wait between requests        (default: 500)
 *   SCRAPE_MAX_PAGES  max pagination pages per section   (default: 0 = all)
 */

import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type {
  ScrapedCourt,
  ScrapedExpert,
  ScrapedInterpreter,
  ScrapedStateAttorney,
  ScrapedDecision,
  ScrapedBankruptcyAdmin,
  ScrapedBankruptcyListing,
  ScrapedBankruptcySale,
} from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(__dirname, 'data')

const BASE_URL = process.env.SCRAPE_BASE_URL ?? 'http://sudacka-mreza.hr'
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS ?? '500', 10)
const MAX_PAGES = parseInt(process.env.SCRAPE_MAX_PAGES ?? '0', 10) // 0 = all

// ─── utilities ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function saveJson(filename: string, data: unknown[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const fp = path.join(DATA_DIR, filename)
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  saved ${filename}: ${data.length} records`)
}

function cleanText(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, ' ').trim()
}

/** Strip diacritics + lowercase for fuzzy header matching. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build { normalised-header → column-index } from the first <tr>. */
function headerMap($: cheerio.CheerioAPI, row: cheerio.Element): Map<string, number> {
  const m = new Map<string, number>()
  $(row)
    .find('th, td')
    .each((i, el) => m.set(norm($(el).text()), i))
  return m
}

/** Return the first matching column index, or -1 if none found. */
function col(m: Map<string, number>, ...aliases: string[]): number {
  for (const a of aliases) {
    const idx = m.get(norm(a))
    if (idx !== undefined) return idx
  }
  return -1
}

/** Extract text from the Nth cell of a row. Returns '' when idx < 0. */
function cell($: cheerio.CheerioAPI, row: cheerio.Element, idx: number): string {
  if (idx < 0) return ''
  return cleanText($(row).find('th, td').eq(idx).text())
}

// ─── ASP.NET WebForms hidden-field extraction ─────────────────────────────────

interface AspNetState {
  __VIEWSTATE: string
  __VIEWSTATEGENERATOR: string
  __EVENTVALIDATION: string
  /** Any extra hidden inputs we should pass back verbatim. */
  extras: Record<string, string>
}

function extractAspNetState($: cheerio.CheerioAPI): AspNetState {
  const vs = ($('input[name="__VIEWSTATE"]').val() ?? '') as string
  const vsg = ($('input[name="__VIEWSTATEGENERATOR"]').val() ?? '') as string
  const ev = ($('input[name="__EVENTVALIDATION"]').val() ?? '') as string

  // Collect all hidden inputs that aren't the three main ones
  const extras: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name') ?? ''
    if (!['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION'].includes(name) && name) {
      extras[name] = ($(el).val() ?? '') as string
    }
  })

  return { __VIEWSTATE: vs, __VIEWSTATEGENERATOR: vsg, __EVENTVALIDATION: ev, extras }
}

/** Build a URL-encoded form body for an ASP.NET postback. */
function buildPostbackBody(
  state: AspNetState,
  eventTarget: string,
  eventArgument: string,
): string {
  const params: Record<string, string> = {
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: eventArgument,
    __VIEWSTATE: state.__VIEWSTATE,
    __VIEWSTATEGENERATOR: state.__VIEWSTATEGENERATOR,
    __EVENTVALIDATION: state.__EVENTVALIDATION,
    ...state.extras,
  }
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

// ─── pagination helpers ───────────────────────────────────────────────────────

/**
 * Detect which page we are on (the non-linked bold/span number in the pager)
 * and find a link to the next page.  Returns the postback target/argument
 * needed to navigate to the next page, or null when there is none.
 */
function findNextPagePostback(
  $: cheerio.CheerioAPI,
): { eventTarget: string; eventArgument: string } | null {
  // ASP.NET GridView / Repeater pagers typically render as a table row
  // containing <td><a href="javascript:__doPostBack(...)">2</a> <span>3</span> ...</td>
  // The current page is a <span> (or <b>) that is NOT inside an <a>;
  // the next page is an <a> with text = currentPage + 1.

  let currentPage = -1

  // Try to find current page from non-linked number in pager
  $('table td').each((_, td) => {
    const $td = $(td)
    // Look for a mix of <a> and non-linked numbers — characteristic of ASP.NET pagers
    const links = $td.find('a')
    const spans = $td.find('span, b')
    if (links.length === 0 && spans.length === 0) return

    spans.each((__, el) => {
      if ($(el).closest('a').length === 0) {
        const n = parseInt($(el).text().trim(), 10)
        if (!isNaN(n)) currentPage = n
      }
    })

    // If no spans, look for a td that contains only digits + links (pager row)
    if (currentPage === -1) {
      const text = $td.text().replace(/\s/g, '')
      if (/^\d+$/.test(text) && links.length > 0) {
        // Find the "active" page as the one not in a link
        const tdHtml = $td.html() ?? ''
        const nonLinkedMatch = tdHtml.match(/>(\d+)<\/(?:span|b|strong|td)/)
        if (nonLinkedMatch) currentPage = parseInt(nonLinkedMatch[1], 10)
      }
    }
  })

  if (currentPage < 1) return null

  const nextPageNum = currentPage + 1

  // Find the <a> whose text is exactly the next page number
  let found: { eventTarget: string; eventArgument: string } | null = null

  $('a').each((_, el) => {
    const text = $(el).text().trim()
    if (text !== String(nextPageNum)) return

    // Extract __doPostBack('target','arg') from href or onclick
    const href = $(el).attr('href') ?? ''
    const onclick = $(el).attr('onclick') ?? ''
    const raw = href.includes('__doPostBack') ? href : onclick

    const match = raw.match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/)
    if (match) {
      found = { eventTarget: match[1], eventArgument: match[2] }
    }
  })

  return found
}

/**
 * Also look for explicit ">" or ">>" next-page links in the pager row.
 */
function findExplicitNextPostback(
  $: cheerio.CheerioAPI,
): { eventTarget: string; eventArgument: string } | null {
  const NEXT_TEXTS = ['>', '>>', 'Sljedeća', 'Dalje', 'Naprijed', 'Next']

  for (const text of NEXT_TEXTS) {
    let found: { eventTarget: string; eventArgument: string } | null = null

    $('a').each((_, el) => {
      if (found) return
      if ($(el).text().trim() !== text) return

      const href = $(el).attr('href') ?? ''
      const onclick = $(el).attr('onclick') ?? ''
      const raw = href.includes('__doPostBack') ? href : onclick
      const match = raw.match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/)
      if (match) found = { eventTarget: match[1], eventArgument: match[2] }
    })

    if (found) return found
  }

  // Also check for Page$Next argument
  let found: { eventTarget: string; eventArgument: string } | null = null
  $('a[href*="Page$Next"], a[href*="PageNext"]').first().each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const match = href.match(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/)
    if (match) found = { eventTarget: match[1], eventArgument: match[2] }
  })

  return found
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const DEFAULT_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'hr-HR,hr;q=0.9,en;q=0.1',
  'Accept-Charset': 'utf-8',
  'User-Agent': 'Mozilla/5.0 (compatible; SudackaMrezaMigration/1.0)',
  'Content-Type': 'application/x-www-form-urlencoded',
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  return res.text()
}

async function postPage(url: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body,
  })
  if (!res.ok) throw new Error(`POST ${url} → ${res.status} ${res.statusText}`)
  return res.text()
}

// ─── generic paginating table scraper ────────────────────────────────────────

/**
 * Select the best candidate data table from the page.
 * Prefers the table with the most columns (>= 3) and more than 2 rows.
 * Skips layout/nav tables.
 */
function findMainTable($: cheerio.CheerioAPI): cheerio.Element | null {
  let mainTable: cheerio.Element | null = null
  let maxCols = 2

  $('table').each((_, tbl) => {
    const firstRow = $(tbl).find('tr').first()
    const cols = Math.max(firstRow.find('th').length, firstRow.find('td').length)
    if (cols > maxCols && $(tbl).find('tr').length > 2) {
      maxCols = cols
      mainTable = tbl
    }
  })

  return mainTable
}

async function scrapeAllPages<T>(
  relativeUrl: string,
  label: string,
  extractFn: ($: cheerio.CheerioAPI, rows: cheerio.Element[], hm: Map<string, number>) => T[],
): Promise<T[]> {
  const fullUrl = `${BASE_URL}${relativeUrl}`
  const all: T[] = []
  let pageNum = 0

  console.log(`  Scraping ${label} — ${fullUrl}`)

  let html: string
  try {
    html = await fetchPage(fullUrl)
  } catch (err) {
    console.error(`    ! failed to load initial page: ${(err as Error).message}`)
    return all
  }

  while (true) {
    pageNum++
    await sleep(DELAY_MS)

    const $ = cheerio.load(html)
    const mainTable = findMainTable($)

    if (!mainTable) {
      console.warn(`    [page ${pageNum}] no data table found`)
      break
    }

    const rows = $(mainTable).find('tr').toArray()
    if (rows.length < 2) break

    const hm = headerMap($, rows[0])
    // Skip rows that are themselves header rows (contain <th> children)
    const dataRows = rows.slice(1).filter(r => $(r).find('th').length === 0)

    const batch = extractFn($, dataRows, hm)
    all.push(...batch)
    console.log(`    page ${pageNum}: +${batch.length} (total ${all.length})`)

    if (MAX_PAGES > 0 && pageNum >= MAX_PAGES) {
      console.log(`    reached SCRAPE_MAX_PAGES=${MAX_PAGES}, stopping`)
      break
    }

    // Try to find the postback needed to go to the next page
    const nextPostback = findExplicitNextPostback($) ?? findNextPagePostback($)
    if (!nextPostback) break

    // Build and POST the ASP.NET form to get the next page
    const state = extractAspNetState($)
    const body = buildPostbackBody(state, nextPostback.eventTarget, nextPostback.eventArgument)

    try {
      html = await postPage(fullUrl, body)
    } catch (err) {
      console.error(`    ! pagination POST failed on page ${pageNum}: ${(err as Error).message}`)
      break
    }
  }

  return all
}

// ─── courts — /sudovi.aspx ────────────────────────────────────────────────────

const COURT_TYPE_MAP: Record<string, string> = {
  'opcinski sud': 'municipal',
  'zupanijski sud': 'county',
  'trgovacki sud': 'commercial',
  'prekrsajni sud': 'misdemeanour',
  'visoki trgovacki sud': 'high_commercial',
  'vrhovni sud': 'supreme',
  'upravni sud': 'administrative',
  'ustavni sud': 'constitutional',
}

function mapCourtType(raw: string): string {
  const n = norm(raw)
  for (const [k, v] of Object.entries(COURT_TYPE_MAP)) {
    if (n.includes(k)) return v
  }
  return 'municipal'
}

function extractCourts(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedCourt[] {
  const namC = col(hm, 'Naziv suda', 'Naziv', 'Sud', 'Ime')
  const typC = col(hm, 'Vrsta suda', 'Vrsta', 'Tip')
  const adrC = col(hm, 'Adresa', 'Ulica')
  const citC = col(hm, 'Grad', 'Mjesto', 'Sjedište')
  const couC = col(hm, 'Županija')
  const phnC = col(hm, 'Telefon', 'Tel', 'Tel.')
  const faxC = col(hm, 'Fax', 'Telefaks')
  const emlC = col(hm, 'Email', 'E-mail', 'E-pošta')
  const webC = col(hm, 'Web', 'Web stranica', 'Internet')
  const presC = col(hm, 'Predsjednik', 'Predsjednik suda')

  return rows
    .map(row => {
      const name = cell($, row, namC)
      if (!name) return null
      const city = cell($, row, citC) || 'N/A'
      const rawType = cell($, row, typC) || name
      return {
        name,
        type: mapCourtType(rawType),
        address: cell($, row, adrC) || undefined,
        city,
        county: cell($, row, couC) || undefined,
        phone: cell($, row, phnC) || undefined,
        fax: cell($, row, faxC) || undefined,
        email: cell($, row, emlC) || undefined,
        website: cell($, row, webC) || undefined,
        president: cell($, row, presC) || undefined,
      } satisfies ScrapedCourt
    })
    .filter((r): r is ScrapedCourt => r !== null)
}

// ─── expert witnesses — /vjestaci.aspx ───────────────────────────────────────

const LANGUAGE_CODE_MAP: Record<string, string> = {
  hrvatski: 'hr', hrvatskom: 'hr',
  engleski: 'en', engleskom: 'en',
  njemacki: 'de', njemackom: 'de',
  francuski: 'fr', franceskom: 'fr',
  talijanski: 'it', talijanskom: 'it',
  spanjolski: 'es',
  ruski: 'ru',
  madjarski: 'hu',
  cesk: 'cs',
  slovacki: 'sk',
  slovenski: 'sl',
  srpski: 'sr',
}

function parseLanguageCodes(raw: string): string[] {
  if (!raw) return ['hr']
  const n = norm(raw)
  const found: string[] = []
  for (const [k, v] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (n.includes(k) && !found.includes(v)) found.push(v)
  }
  // Also accept bare BCP-47 codes like "hr, en, de"
  const bareMatches = raw.match(/\b([a-z]{2})\b/g) ?? []
  for (const m of bareMatches) {
    if (!found.includes(m)) found.push(m)
  }
  return found.length > 0 ? found : ['hr']
}

function extractExperts(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedExpert[] {
  const namC = col(hm, 'Ime i prezime', 'Ime', 'Naziv', 'Vještak')
  const spcC = col(hm, 'Područje vještačenja', 'Područje', 'Specijalizacija', 'Struka')
  const crtC = col(hm, 'Sud', 'Dodijeljeni sud', 'Sudovi')
  const couC = col(hm, 'Županija')
  const citC = col(hm, 'Grad', 'Mjesto')
  const phnC = col(hm, 'Telefon', 'Tel', 'Tel.')
  const emlC = col(hm, 'Email', 'E-mail')
  const lngC = col(hm, 'Jezici', 'Jezik', 'Languages')

  return rows
    .map(row => {
      const name = cell($, row, namC)
      if (!name) return null
      const specialityRaw = cell($, row, spcC)
      const specialityAreas = specialityRaw
        ? specialityRaw.split(/[,;\/]/).map(s => s.trim()).filter(Boolean)
        : []
      const courtRaw = cell($, row, crtC)
      const courtNames = courtRaw
        ? courtRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : []
      const langRaw = cell($, row, lngC)
      const languages = parseLanguageCodes(langRaw)
      return {
        name,
        specialityAreas,
        languages,
        county: cell($, row, couC) || undefined,
        city: cell($, row, citC) || undefined,
        phone: cell($, row, phnC) || undefined,
        email: cell($, row, emlC) || undefined,
        courtNames,
      } satisfies ScrapedExpert
    })
    .filter((r): r is ScrapedExpert => r !== null)
}

// ─── interpreters — /tumaci.aspx ─────────────────────────────────────────────

/**
 * Normalise a raw language-pair string to a BCP-47 "xx-yy" pair.
 * Input examples: "hrvatski-engleski", "hr/en", "Engleski - Hrvatski"
 */
function normaliseLanguagePair(raw: string): string {
  const parts = raw.split(/[-\/–—]/).map(s => s.trim())
  const codes = parts
    .map(p => {
      const n = norm(p)
      for (const [k, v] of Object.entries(LANGUAGE_CODE_MAP)) {
        if (n.includes(k)) return v
      }
      // Already looks like a code (2–3 chars)
      if (/^[a-z]{2,3}$/i.test(p)) return p.toLowerCase()
      return null
    })
    .filter((c): c is string => c !== null)
  return codes.length >= 2 ? `${codes[0]}-${codes[1]}` : codes[0] ?? raw
}

function extractInterpreters(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedInterpreter[] {
  const namC = col(hm, 'Ime i prezime', 'Ime', 'Tumač')
  const pairC = col(hm, 'Jezični par', 'Jezični parovi', 'Jezici', 'Par')
  const crtC = col(hm, 'Sud', 'Dodijeljeni sud')
  const couC = col(hm, 'Županija')
  const citC = col(hm, 'Grad', 'Mjesto')
  const phnC = col(hm, 'Telefon', 'Tel', 'Tel.')
  const emlC = col(hm, 'Email', 'E-mail')

  return rows
    .map(row => {
      const name = cell($, row, namC)
      if (!name) return null
      const rawPairs = cell($, row, pairC)
      const languagePairs = rawPairs
        ? rawPairs.split(/[,;]/).map(p => normaliseLanguagePair(p.trim())).filter(Boolean)
        : []
      const courtRaw = cell($, row, crtC)
      const courtNames = courtRaw
        ? courtRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : []
      return {
        name,
        languagePairs,
        county: cell($, row, couC) || undefined,
        city: cell($, row, citC) || undefined,
        phone: cell($, row, phnC) || undefined,
        email: cell($, row, emlC) || undefined,
        courtNames,
      } satisfies ScrapedInterpreter
    })
    .filter((r): r is ScrapedInterpreter => r !== null)
}

// ─── state attorneys — /dorh.aspx ────────────────────────────────────────────

function extractStateAttorneys(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedStateAttorney[] {
  const namC = col(hm, 'Naziv', 'Ime', 'Naziv ureda', 'Državno odvjetništvo')
  const adrC = col(hm, 'Adresa', 'Ulica')
  const citC = col(hm, 'Grad', 'Mjesto', 'Sjedište')
  const couC = col(hm, 'Županija')
  const phnC = col(hm, 'Telefon', 'Tel', 'Tel.')
  const faxC = col(hm, 'Fax', 'Telefaks')
  const emlC = col(hm, 'Email', 'E-mail')

  return rows
    .map(row => {
      const name = cell($, row, namC)
      if (!name) return null
      const city = cell($, row, citC) || 'N/A'
      return {
        name,
        address: cell($, row, adrC) || undefined,
        city,
        county: cell($, row, couC) || undefined,
        phone: cell($, row, phnC) || undefined,
        fax: cell($, row, faxC) || undefined,
        email: cell($, row, emlC) || undefined,
      } satisfies ScrapedStateAttorney
    })
    .filter((r): r is ScrapedStateAttorney => r !== null)
}

// ─── court decisions — /sudska-praksa.aspx ───────────────────────────────────

const DECISION_TYPE_MAP: Record<string, string> = {
  'gradjansko': 'civil', 'gradjansku': 'civil',
  'kazneno': 'criminal', 'kaznenoj': 'criminal',
  'trgovacko': 'commercial', 'trgovackim': 'commercial',
  'upravno': 'administrative', 'upravnom': 'administrative',
  'ustavno': 'constitutional', 'ustavnom': 'constitutional',
  'ecj': 'ecj',
  'ecthr': 'ecthr',
}

function mapDecisionType(raw: string): string {
  const n = norm(raw)
  for (const [k, v] of Object.entries(DECISION_TYPE_MAP)) {
    if (n.includes(k)) return v
  }
  return 'civil'
}

/** Parse a Croatian date string (dd.mm.yyyy or dd. mm. yyyy) into ISO-8601. */
function parseCroatianDate(raw: string): string {
  const m = raw.match(/(\d{1,2})[.\s]+(\d{1,2})[.\s]+(\d{4})/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`
  }
  // Already ISO or unrecognised — return as-is
  return raw || new Date().toISOString()
}

function extractDecisions(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedDecision[] {
  const titC = col(hm, 'Naslov', 'Naslov odluke', 'Predmet', 'Odluka')
  const crtC = col(hm, 'Sud', 'Naziv suda')
  const typC = col(hm, 'Vrsta', 'Vrsta odluke', 'Kategorija', 'Grana prava')
  const datC = col(hm, 'Datum', 'Datum odluke')
  const csnC = col(hm, 'Broj predmeta', 'Broj', 'Predmetni broj', 'Oznaka')
  const sumC = col(hm, 'Sažetak', 'Opis', 'Napomena')
  const catC = col(hm, 'Kategorija', 'Oblast', 'Grana')
  const txtC = col(hm, 'Puni tekst', 'Tekst', 'Sadržaj')

  return rows
    .map(row => {
      const title = cell($, row, titC)
      const courtName = cell($, row, crtC)
      const caseNumber = cell($, row, csnC)
      if (!title || !caseNumber) return null
      return {
        title,
        courtName: courtName || 'Nepoznat',
        decisionType: mapDecisionType(cell($, row, typC)),
        date: parseCroatianDate(cell($, row, datC)),
        caseNumber,
        summary: cell($, row, sumC) || undefined,
        category: cell($, row, catC) || undefined,
        fullText: cell($, row, txtC) || undefined,
      } satisfies ScrapedDecision
    })
    .filter((r): r is ScrapedDecision => r !== null)
}

// ─── bankruptcy listings — /web-stecaj.aspx ──────────────────────────────────

function mapBankruptcyStatus(raw: string): string {
  const n = norm(raw)
  if (n.includes('dovrsen') || n.includes('zavrsen') || n.includes('completed')) return 'completed'
  if (n.includes('povucen') || n.includes('withdrawn')) return 'withdrawn'
  return 'active'
}

function extractBankruptcyListings(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedBankruptcyListing[] {
  const csnC = col(hm, 'Broj predmeta', 'Broj', 'Predmetni broj')
  const debC = col(hm, 'Dužnik', 'Naziv dužnika', 'Tvrtka')
  const crtC = col(hm, 'Sud', 'Naziv suda')
  const admC = col(hm, 'Stečajni upravitelj', 'Upravitelj')
  const ddlC = col(hm, 'Rok', 'Datum roka', 'Rok prijave')
  const staC = col(hm, 'Status')
  const pubC = col(hm, 'Datum objave', 'Objavljeno')
  const emlC = col(hm, 'Email', 'Kontakt email')
  const phnC = col(hm, 'Telefon', 'Kontakt telefon')
  const desC = col(hm, 'Opis', 'Napomena', 'Imovina')

  return rows
    .map(row => {
      const caseNumber = cell($, row, csnC)
      const debtorName = cell($, row, debC)
      if (!caseNumber || !debtorName) return null
      return {
        caseNumber,
        debtorName,
        courtName: cell($, row, crtC) || 'Nepoznat',
        administratorName: cell($, row, admC) || undefined,
        deadline: parseCroatianDate(cell($, row, ddlC)) || undefined,
        status: mapBankruptcyStatus(cell($, row, staC)),
        publishedAt: parseCroatianDate(cell($, row, pubC)) || undefined,
        contactEmail: cell($, row, emlC) || undefined,
        contactPhone: cell($, row, phnC) || undefined,
        description: cell($, row, desC) || undefined,
      } satisfies ScrapedBankruptcyListing
    })
    .filter((r): r is ScrapedBankruptcyListing => r !== null)
}

// ─── bankruptcy sales / offers — /stecaj-ponude.aspx ─────────────────────────

/**
 * The stečaj-ponude page lists individual asset sale offers from ongoing
 * bankruptcy proceedings.  Each row typically has: title, description,
 * estimated price, bidding/offer deadline, and a contact.
 */
function extractBankruptcySales(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedBankruptcySale[] {
  const titC = col(hm, 'Naslov', 'Naziv', 'Predmet prodaje', 'Opis imovine', 'Ponuda')
  const desC = col(hm, 'Opis', 'Napomena', 'Detalji', 'Imovina')
  const priC = col(hm, 'Cijena', 'Početna cijena', 'Vrijednost', 'Iznos')
  const ddlC = col(hm, 'Rok', 'Rok ponude', 'Datum roka', 'Rok prijave', 'Krajnji rok')
  const conC = col(hm, 'Kontakt', 'Kontakt osoba', 'Email', 'Telefon')

  // Fallback: if the page looks like a bankruptcy listing page (has Broj predmeta),
  // delegate to extractBankruptcyListings and adapt the output shape.
  const hasListingColumns = col(hm, 'Broj predmeta', 'Broj') >= 0 && col(hm, 'Dužnik', 'Naziv dužnika') >= 0
  if (hasListingColumns && titC < 0) {
    // Re-use listing extractor and coerce to sale shape
    const listings = extractBankruptcyListings($, rows, hm)
    return listings.map(l => ({
      title: l.debtorName,
      description: l.description ?? '',
      price: '',
      deadline: l.deadline ?? '',
      contact: l.contactEmail ?? l.contactPhone ?? undefined,
    }))
  }

  return rows
    .map(row => {
      const title = cell($, row, titC)
      if (!title) return null
      return {
        title,
        description: cell($, row, desC) || '',
        price: cell($, row, priC) || '',
        deadline: cell($, row, ddlC) || '',
        contact: cell($, row, conC) || undefined,
      } satisfies ScrapedBankruptcySale
    })
    .filter((r): r is ScrapedBankruptcySale => r !== null)
}

// ─── bankruptcy administrators — /stecajni-upravitelji.aspx (if present) ─────

function extractBankruptcyAdmins(
  $: cheerio.CheerioAPI,
  rows: cheerio.Element[],
  hm: Map<string, number>,
): ScrapedBankruptcyAdmin[] {
  const namC = col(hm, 'Ime i prezime', 'Ime', 'Stečajni upravitelj', 'Upravitelj')
  const licC = col(hm, 'Broj licence', 'Licenca', 'Licence')
  const phnC = col(hm, 'Telefon', 'Tel', 'Tel.')
  const emlC = col(hm, 'Email', 'E-mail')
  const adrC = col(hm, 'Adresa')
  const citC = col(hm, 'Grad', 'Mjesto')
  const couC = col(hm, 'Županija')

  return rows
    .map(row => {
      const name = cell($, row, namC)
      if (!name) return null
      return {
        name,
        licenceNumber: cell($, row, licC) || undefined,
        phone: cell($, row, phnC) || undefined,
        email: cell($, row, emlC) || undefined,
        address: cell($, row, adrC) || undefined,
        city: cell($, row, citC) || undefined,
        county: cell($, row, couC) || undefined,
      } satisfies ScrapedBankruptcyAdmin
    })
    .filter((r): r is ScrapedBankruptcyAdmin => r !== null)
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function scrapeAll(): Promise<void> {
  console.log('\n=== Sudačka Mreža — Scraper ===')
  console.log(`Base URL : ${BASE_URL}`)
  console.log(`Delay    : ${DELAY_MS} ms`)
  console.log(`Max pages: ${MAX_PAGES === 0 ? 'unlimited' : MAX_PAGES}\n`)

  // 1. Courts — needed first because many other records reference them
  try {
    const courts = await scrapeAllPages('/sudovi.aspx', 'courts', extractCourts)
    saveJson('courts.json', courts)
  } catch (err) {
    console.error('  ! courts scrape failed:', (err as Error).message)
  }

  // 2. State attorneys (DORH)
  try {
    const stateAttorneys = await scrapeAllPages('/dorh.aspx', 'state-attorneys', extractStateAttorneys)
    saveJson('state-attorneys.json', stateAttorneys)
  } catch (err) {
    console.error('  ! state-attorneys scrape failed:', (err as Error).message)
  }

  // 3. Expert witnesses
  try {
    const experts = await scrapeAllPages('/vjestaci.aspx', 'expert-witnesses', extractExperts)
    saveJson('experts.json', experts)
  } catch (err) {
    console.error('  ! expert-witnesses scrape failed:', (err as Error).message)
  }

  // 4. Interpreters
  try {
    const interpreters = await scrapeAllPages('/tumaci.aspx', 'interpreters', extractInterpreters)
    saveJson('interpreters.json', interpreters)
  } catch (err) {
    console.error('  ! interpreters scrape failed:', (err as Error).message)
  }

  // 5. Court decisions — the largest dataset (many pages)
  try {
    const decisions = await scrapeAllPages('/sudska-praksa.aspx', 'court-decisions', extractDecisions)
    saveJson('decisions.json', decisions)
  } catch (err) {
    console.error('  ! court-decisions scrape failed:', (err as Error).message)
  }

  // 6. Bankruptcy listings (web-stečaj)
  try {
    const bankruptcyListings = await scrapeAllPages(
      '/web-stecaj.aspx', 'bankruptcy-listings', extractBankruptcyListings,
    )
    saveJson('bankruptcy-listings.json', bankruptcyListings)
  } catch (err) {
    console.error('  ! bankruptcy-listings scrape failed:', (err as Error).message)
  }

  // 7. Bankruptcy sales / offers (stečaj ponude)
  try {
    const bankruptcySales = await scrapeAllPages(
      '/stecaj-ponude.aspx', 'bankruptcy-sales', extractBankruptcySales,
    )
    saveJson('bankruptcy-sales.json', bankruptcySales)
  } catch (err) {
    console.error('  ! bankruptcy-sales scrape failed:', (err as Error).message)
  }

  // 8. Bankruptcy administrators — may be a separate page on some site versions
  try {
    const admins = await scrapeAllPages(
      '/stecajni-upravitelji.aspx', 'bankruptcy-admins', extractBankruptcyAdmins,
    )
    if (admins.length > 0) {
      saveJson('bankruptcy-admins.json', admins)
    } else {
      // Fall back: try to extract admins from the stečaj page itself
      const adminsFromListings = await scrapeAllPages(
        '/web-stecaj.aspx', 'bankruptcy-admins (from listings)', extractBankruptcyAdmins,
      )
      saveJson('bankruptcy-admins.json', adminsFromListings)
    }
  } catch (err) {
    console.error('  ! bankruptcy-admins scrape failed:', (err as Error).message)
    saveJson('bankruptcy-admins.json', [])
  }

  console.log('\n=== Scrape complete — JSON files written to src/migration/data/ ===\n')
}

// ─── direct execution ─────────────────────────────────────────────────────────

scrapeAll().catch(err => {
  console.error('Scraper failed:', err)
  process.exit(1)
})
