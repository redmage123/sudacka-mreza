/**
 * GET /api/rss/court-decisions.xml
 *
 * RSS 2.0 feed of the 50 most recently published court decisions (FR-043).
 *
 * Feed is served with Content-Type: application/rss+xml and a 60-second
 * public cache header so CDN/proxy layers can cache it briefly.
 *
 * Feed structure (spec FR-043):
 *   - <title>  : caseNumber + " — " + title
 *   - <link>   : canonical URL to decision detail page
 *   - <guid>   : same as <link>, isPermaLink="true"
 *   - <pubDate>: decision date in RFC 2822 format
 *   - <category>: decisionType
 *   - <description>: summary (if present) or first 300 chars of searchVector text
 */

import { Router, Request, Response } from 'express'

function toRfc2822(date: string | Date): string {
  return new Date(date).toUTCString()
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function plainText(value: string | null | undefined, maxLen = 300): string {
  if (!value) return ''
  const stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped
}

export function createRssRouter(payload: any) {
  const router = Router()

  router.get('/rss/court-decisions.xml', async (_req: Request, res: Response) => {
    try {
      const baseUrl = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')

      const result = await payload.find({
        collection: 'court-decisions',
        limit: 50,
        sort: '-date',
      })

      const items: string[] = (result.docs as any[]).map((doc) => {
        const id = String(doc.id)
        const slug = String(doc.slug ?? '')
        const titleText = [doc.caseNumber, doc.title].filter(Boolean).join(' — ')
        const link = `${baseUrl}/hr/sudska-praksa/${id}-${slug}`

        // pubDate: prefer doc.date (decision date), fall back to createdAt
        const pubDate = toRfc2822(doc.date ?? doc.createdAt)

        const descriptionText =
          doc.summary
            ? plainText(doc.summary)
            : plainText(doc.searchVector ?? doc.title ?? '')

        return [
          '    <item>',
          `      <title>${escapeXml(titleText)}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <category>${escapeXml(doc.decisionType ?? '')}</category>`,
          `      <description>${escapeXml(descriptionText)}</description>`,
          '    </item>',
        ].join('\n')
      })

      const buildDate = toRfc2822(new Date())
      const feedUrl = `${baseUrl}/api/rss/court-decisions.xml`
      const siteUrl = `${baseUrl}/hr/sudska-praksa/`

      const rss = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>Sudska praksa — Sudačka mreža</title>`,
        `    <link>${escapeXml(siteUrl)}</link>`,
        `    <description>Najnovije sudske odluke s portala Sudačka mreža</description>`,
        `    <language>hr</language>`,
        `    <lastBuildDate>${buildDate}</lastBuildDate>`,
        `    <ttl>60</ttl>`,
        `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
        ...items,
        '  </channel>',
        '</rss>',
      ].join('\n')

      res.set('Content-Type', 'application/rss+xml; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=60')
      return res.send(rss)
    } catch (err) {
      payload.logger.error('RSS generation error:', err)
      return res.status(500).send('Internal Server Error')
    }
  })

  // -------------------------------------------------------------------------
  // GET /rss/decisions — Filtered RSS feed for court decisions
  // Optional ?court= (partial match) and ?category= (exact match on decisionType)
  // -------------------------------------------------------------------------
  router.get('/rss/decisions', async (req: Request, res: Response) => {
    try {
      const baseUrl = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')
      const courtParam = typeof req.query.court === 'string' ? req.query.court.trim() : ''
      const categoryParam = typeof req.query.category === 'string' ? req.query.category.trim() : ''

      // Build dynamic feed title
      let feedTitle = 'Sudska praksa — Sudačka mreža'
      if (courtParam) feedTitle = `Sudska praksa — ${courtParam} — Sudačka mreža`
      else if (categoryParam) feedTitle = `Sudska praksa — ${categoryParam} — Sudačka mreža`

      // Build where clause
      const where: Record<string, any> = {}

      if (courtParam) {
        const courtsResult = await payload.find({
          collection: 'courts',
          where: { name: { contains: courtParam } },
          limit: 100,
        })
        const courtIds = (courtsResult.docs as any[]).map((c: any) => c.id)
        if (courtIds.length === 0) {
          // No matching courts → return empty feed
          where['court'] = { in: [-1] }
        } else {
          where['court'] = { in: courtIds }
        }
      }

      if (categoryParam) {
        where['decisionType'] = { equals: categoryParam }
      }

      const result = await payload.find({
        collection: 'court-decisions',
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: 50,
        sort: '-date',
      })

      const items: string[] = (result.docs as any[]).map((doc) => {
        const id = String(doc.id)
        const slug = String(doc.slug ?? '')
        const titleText = [doc.caseNumber, doc.title].filter(Boolean).join(' — ')
        const link = `${baseUrl}/hr/sudska-praksa/${id}-${slug}`
        const pubDate = toRfc2822(doc.date ?? doc.createdAt)
        const descriptionText = doc.summary
          ? plainText(doc.summary)
          : plainText(doc.searchVector ?? doc.title ?? '')

        return [
          '    <item>',
          `      <title>${escapeXml(titleText)}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <category>${escapeXml(doc.decisionType ?? '')}</category>`,
          `      <description>${escapeXml(descriptionText)}</description>`,
          '    </item>',
        ].join('\n')
      })

      const buildDate = toRfc2822(new Date())
      const feedUrl = `${baseUrl}/api/rss/decisions`
      const siteUrl = `${baseUrl}/hr/sudska-praksa/`

      const rss = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>${escapeXml(feedTitle)}</title>`,
        `    <link>${escapeXml(siteUrl)}</link>`,
        `    <description>Najnovije sudske odluke s portala Sudačka mreža</description>`,
        `    <language>hr</language>`,
        `    <lastBuildDate>${buildDate}</lastBuildDate>`,
        `    <ttl>60</ttl>`,
        `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
        ...items,
        '  </channel>',
        '</rss>',
      ].join('\n')

      res.set('Content-Type', 'application/rss+xml; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=60')
      return res.send(rss)
    } catch (err) {
      payload.logger.error('RSS /decisions generation error:', err)
      return res.status(500).send('Internal Server Error')
    }
  })

  // -------------------------------------------------------------------------
  // GET /rss/news — RSS feed for published news posts
  // -------------------------------------------------------------------------
  router.get('/rss/news', async (_req: Request, res: Response) => {
    try {
      const baseUrl = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')

      const result = await payload.find({
        collection: 'news-posts',
        where: {
          and: [
            { publishedAt: { exists: true } },
            { publishedAt: { less_than_equal: new Date().toISOString() } },
          ],
        },
        limit: 50,
        sort: '-publishedAt',
      })

      const items: string[] = (result.docs as any[]).map((doc) => {
        const slug = String(doc.slug ?? '')
        const link = `${baseUrl}/hr/vijesti/${slug}`
        const pubDate = toRfc2822(doc.publishedAt ?? doc.createdAt)
        const descriptionText = doc.excerpt
          ? plainText(doc.excerpt)
          : plainText(doc.content ?? '')

        return [
          '    <item>',
          `      <title>${escapeXml(String(doc.title ?? ''))}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <category>${escapeXml(doc.category ?? '')}</category>`,
          `      <description>${escapeXml(descriptionText)}</description>`,
          '    </item>',
        ].join('\n')
      })

      const buildDate = toRfc2822(new Date())
      const feedUrl = `${baseUrl}/api/rss/news`
      const siteUrl = `${baseUrl}/hr/vijesti/`

      const rss = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>Vijesti — Sudačka mreža</title>`,
        `    <link>${escapeXml(siteUrl)}</link>`,
        `    <description>Najnovije vijesti s portala Sudačka mreža</description>`,
        `    <language>hr</language>`,
        `    <lastBuildDate>${buildDate}</lastBuildDate>`,
        `    <ttl>300</ttl>`,
        `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
        ...items,
        '  </channel>',
        '</rss>',
      ].join('\n')

      res.set('Content-Type', 'application/rss+xml; charset=utf-8')
      res.set('Cache-Control', 'public, max-age=300')
      return res.send(rss)
    } catch (err) {
      payload.logger.error('RSS /news generation error:', err)
      return res.status(500).send('Internal Server Error')
    }
  })

  return router
}
