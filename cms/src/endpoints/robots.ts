/**
 * GET /robots.txt
 *
 * Standard robots.txt allowing all crawlers and pointing to the sitemap.
 * Cache: 24 hours (public, max-age=86400).
 */

import { Router, Request, Response } from 'express'

export function createRobotsRouter() {
  const router = Router()

  router.get('/robots.txt', (_req: Request, res: Response) => {
    const base = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')

    const content = [
      'User-agent: *',
      'Allow: /',
      '',
      '# Disallow admin and API paths from public indexing',
      'Disallow: /admin/',
      'Disallow: /api/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n')

    res.set('Content-Type', 'text/plain; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=86400')
    return res.send(content)
  })

  return router
}
