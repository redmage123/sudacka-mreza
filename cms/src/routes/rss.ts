/**
 * GET /api/rss/court-decisions.xml
 *
 * RSS 2.0 feed of the 50 most recently published court decisions (FR-043).
 *
 * Feed is served with Content-Type: application/rss+xml and a 60-second
 * public cache header so CDN/proxy layers can cache it briefly.
 *
 * Feed structure (spec FR-043):
 *   - <title>  : caseNumber + " — " + title_hr
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
        const titleText = [doc.caseNumber, doc.title_hr].filter(Boolean).join(' — ')
        const link = `${baseUrl}/hr/sudska-praksa/${id}-${slug}`

        // pubDate: prefer doc.date (decision date), fall back to createdAt
        const pubDate = toRfc2822(doc.date ?? doc.createdAt)

        const descriptionText =
          doc.summary
            ? plainText(doc.summary)
            : plainText(doc.searchVector ?? doc.title_hr ?? '')

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

  return router
}
