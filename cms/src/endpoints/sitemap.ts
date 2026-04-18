/**
 * GET /sitemap.xml
 *
 * Auto-generated XML sitemap covering all CMS content:
 *   - Static pages (homepage, about, contact, etc.)
 *   - Court decisions   → /hr/sudska-praksa/:id-:slug
 *   - Expert witnesses  → /hr/strucnjaci/vjestaci/:id
 *   - Interpreters      → /hr/strucnjaci/tumaci/:id
 *   - Courts            → /hr/sudovi/:id
 *   - News posts        → /hr/vijesti/:slug
 *
 * Each URL is emitted in both Croatian (/hr/) and English (/en/) variants
 * using <xhtml:link> alternates per the hreflang sitemap spec.
 *
 * lastmod is derived from the record's updatedAt field.
 * Cache: 1 hour (public, max-age=3600).
 */

import { Router, Request, Response } from 'express'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toW3cDate(date: string | Date | null | undefined): string {
  if (!date) return new Date().toISOString().split('T')[0]
  return new Date(date).toISOString().split('T')[0]
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface UrlEntry {
  loc: string            // canonical URL (hr version)
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: string
  alternateLoc?: string  // en version (optional)
}

function buildUrlBlock(base: string, entry: UrlEntry): string {
  const hrLoc = entry.loc
  const enLoc = entry.alternateLoc ?? hrLoc.replace('/hr/', '/en/')

  return [
    '  <url>',
    `    <loc>${escapeXml(hrLoc)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
    entry.priority ? `    <priority>${entry.priority}</priority>` : '',
    `    <xhtml:link rel="alternate" hreflang="hr" href="${escapeXml(hrLoc)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enLoc)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(hrLoc)}"/>`,
    '  </url>',
  ].filter(Boolean).join('\n')
}

// ─── Static pages ─────────────────────────────────────────────────────────────

function staticPages(base: string): UrlEntry[] {
  const today = new Date().toISOString().split('T')[0]
  return [
    { loc: `${base}/hr`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${base}/hr/pretraga`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/hr/sudska-praksa/pretraga`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: `${base}/hr/sudska-praksa/vts`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { loc: `${base}/hr/sudska-praksa/esljp`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { loc: `${base}/hr/strucnjaci/vjestaci`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/hr/strucnjaci/tumaci`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/hr/sudovi`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/hr/sudovi/dorh`, lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { loc: `${base}/hr/sudovi/nadleznost`, lastmod: today, changefreq: 'monthly', priority: '0.6' },
    { loc: `${base}/hr/stecaj`, lastmod: today, changefreq: 'daily', priority: '0.7' },
    { loc: `${base}/hr/stecaj/oglasi`, lastmod: today, changefreq: 'daily', priority: '0.7' },
    { loc: `${base}/hr/stecaj/upravitelji`, lastmod: today, changefreq: 'weekly', priority: '0.6' },
    { loc: `${base}/hr/stecaj/zakoni`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
    { loc: `${base}/hr/statistika`, lastmod: today, changefreq: 'hourly', priority: '0.6' },
    { loc: `${base}/hr/pristojbe`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
    { loc: `${base}/hr/pravna-pomoc`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
    { loc: `${base}/hr/vijesti`, lastmod: today, changefreq: 'daily', priority: '0.8' },
    { loc: `${base}/hr/o-nama`, lastmod: today, changefreq: 'monthly', priority: '0.4' },
    { loc: `${base}/hr/kontakt`, lastmod: today, changefreq: 'monthly', priority: '0.4' },
    { loc: `${base}/hr/galerije`, lastmod: today, changefreq: 'monthly', priority: '0.4' },
    { loc: `${base}/hr/mapa`, lastmod: today, changefreq: 'monthly', priority: '0.4' },
  ]
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createSitemapRouter(payload: any) {
  const router = Router()

  router.get('/sitemap.xml', async (_req: Request, res: Response) => {
    try {
      const base = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')
      const entries: string[] = []

      // ── Static pages ───────────────────────────────────────────────────────
      for (const page of staticPages(base)) {
        entries.push(buildUrlBlock(base, page))
      }

      // ── Court decisions ────────────────────────────────────────────────────
      // Paginate in batches of 1000 to handle large datasets
      let decisionsPage = 1
      let decisionsTotalPages = 1
      do {
        const result = await payload.find({
          collection: 'court-decisions',
          limit: 1000,
          page: decisionsPage,
          sort: '-updatedAt',
          depth: 0,
        })
        decisionsTotalPages = result.totalPages ?? 1

        for (const doc of result.docs as any[]) {
          const id = String(doc.id)
          const slug = doc.slug ? `-${String(doc.slug)}` : ''
          const path = `/hr/sudska-praksa/${id}${slug}`
          entries.push(buildUrlBlock(base, {
            loc: `${base}${path}`,
            lastmod: toW3cDate(doc.updatedAt),
            changefreq: 'monthly',
            priority: '0.6',
          }))
        }
        decisionsPage++
      } while (decisionsPage <= decisionsTotalPages)

      // ── Expert witnesses ───────────────────────────────────────────────────
      let expertsPage = 1
      let expertsTotalPages = 1
      do {
        const result = await payload.find({
          collection: 'expert-witnesses',
          limit: 500,
          page: expertsPage,
          sort: '-updatedAt',
          depth: 0,
        })
        expertsTotalPages = result.totalPages ?? 1

        for (const doc of result.docs as any[]) {
          const id = String(doc.id)
          entries.push(buildUrlBlock(base, {
            loc: `${base}/hr/strucnjaci/vjestaci/${id}`,
            lastmod: toW3cDate(doc.updatedAt),
            changefreq: 'monthly',
            priority: '0.5',
          }))
        }
        expertsPage++
      } while (expertsPage <= expertsTotalPages)

      // ── Interpreters ───────────────────────────────────────────────────────
      let interpretersPage = 1
      let interpretersTotalPages = 1
      do {
        const result = await payload.find({
          collection: 'interpreters',
          limit: 500,
          page: interpretersPage,
          sort: '-updatedAt',
          depth: 0,
        })
        interpretersTotalPages = result.totalPages ?? 1

        for (const doc of result.docs as any[]) {
          const id = String(doc.id)
          entries.push(buildUrlBlock(base, {
            loc: `${base}/hr/strucnjaci/tumaci/${id}`,
            lastmod: toW3cDate(doc.updatedAt),
            changefreq: 'monthly',
            priority: '0.5',
          }))
        }
        interpretersPage++
      } while (interpretersPage <= interpretersTotalPages)

      // ── Courts ─────────────────────────────────────────────────────────────
      let courtsPage = 1
      let courtsTotalPages = 1
      do {
        const result = await payload.find({
          collection: 'courts',
          limit: 500,
          page: courtsPage,
          sort: '-updatedAt',
          depth: 0,
        })
        courtsTotalPages = result.totalPages ?? 1

        for (const doc of result.docs as any[]) {
          const id = String(doc.id)
          entries.push(buildUrlBlock(base, {
            loc: `${base}/hr/sudovi/${id}`,
            lastmod: toW3cDate(doc.updatedAt),
            changefreq: 'monthly',
            priority: '0.6',
          }))
        }
        courtsPage++
      } while (courtsPage <= courtsTotalPages)

      // ── News posts (published only) ────────────────────────────────────────
      let newsPage = 1
      let newsTotalPages = 1
      do {
        const result = await payload.find({
          collection: 'news-posts',
          where: {
            and: [
              { publishedAt: { exists: true } },
              { publishedAt: { less_than_equal: new Date().toISOString() } },
            ],
          },
          limit: 500,
          page: newsPage,
          sort: '-publishedAt',
          depth: 0,
        })
        newsTotalPages = result.totalPages ?? 1

        for (const doc of result.docs as any[]) {
          const slug = String(doc.slug ?? doc.id)
          entries.push(buildUrlBlock(base, {
            loc: `${base}/hr/vijesti/${slug}`,
            lastmod: toW3cDate(doc.updatedAt ?? doc.publishedAt),
            changefreq: 'monthly',
            priority: '0.7',
          }))
        }
        newsPage++
      } while (newsPage <= newsTotalPages)

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset',
        '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '  xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        ...entries,
        '</urlset>',
      ].join('\n')

      res.set('Content-Type', 'application/xml; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=3600')
      return res.send(xml)
    } catch (err) {
      payload.logger.error('Sitemap generation error:', err)
      return res.status(500).send('Internal Server Error')
    }
  })

  return router
}
