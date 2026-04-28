import express from 'express'
import { getPayload, handleEndpoints } from 'payload'
import config from './payload.config.js'

// Custom route modules
import contactRouter from './routes/contact.js'
import courtFeeRouter from './routes/court-fee.js'
import { createDecisionsSearchRouter } from './routes/decisions-search.js'
import { createHybridSearchRouter } from './routes/hybrid-search.js'
import { createGlobalSearchRouter } from './routes/global-search.js'
import { createJurisdictionRouter } from './routes/jurisdiction.js'
import { createRssRouter } from './routes/rss.js'
import { createPdfExportRouter } from './routes/pdfExport.js'
import { createSubscribeRouter } from './routes/subscribe.js'
import { createStatisticsRouter } from './routes/statistics.js'
import { createChatRouter } from './routes/chat.js'
import { createChatFeedbackRouter } from './routes/chat-feedback.js'
import { createPublicApiRouter } from './endpoints/publicApi.js'
import { createSitemapRouter } from './endpoints/sitemap.js'
import { createRobotsRouter } from './endpoints/robots.js'
import { startNotificationDigest } from './jobs/notificationDigest.js'

const app = express()

// ── Security hardening ────────────────────────────────────────────────────
// Disable X-Powered-By header (reveals Express)
app.disable('x-powered-by')

// Security headers for all CMS responses
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
  next()
})

// Parse JSON bodies for all routes (including our custom POST /api/contact)
app.use(express.json())

const start = async () => {
  // ---------------------------------------------------------------------------
  // Environment variable validation (spec §11.8)
  // Fail fast at startup rather than silently misconfiguring the app.
  // ---------------------------------------------------------------------------
  if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32) {
    throw new Error('FATAL: PAYLOAD_SECRET must be at least 32 characters')
  }

  if (!process.env.DATABASE_URI) {
    throw new Error('FATAL: DATABASE_URI is required')
  }

  // ---------------------------------------------------------------------------
  // Payload CMS init (Payload 3 — getPayload API)
  // secret and express are configured in buildConfig (payload.config.ts)
  // ---------------------------------------------------------------------------
  const payload = await getPayload({
    config,
    onInit: (p) => {
      p.logger.info(`Payload Admin URL: ${p.getAdminURL()}`)
    },
  })

  // ---------------------------------------------------------------------------
  // Custom API routes — mounted AFTER Payload init so the payload instance
  // is available. All paths are under /api/ to sit beside Payload's own
  // /api/<collection-slug> REST endpoints.
  //
  //   POST /api/contact                     Contact form (rate-limited, Zod, Resend)
  //   GET  /api/decisions/search            Full-text search with ts_rank / ts_headline
  //   GET  /api/decisions/hybrid-search     Hybrid search: FTS + RAG semantic (RRF merge)
  //   GET  /api/search                      Global search across all content types
  //   GET  /api/court-fee/calculate         Court fee calculator
  //   GET  /api/court-fee/types             Proceeding type list for UI dropdowns
  //   GET  /api/jurisdiction                Point-in-polygon jurisdiction lookup
  //   GET  /api/rss/court-decisions.xml     RSS 2.0 feed (latest 50 decisions)
  //   GET  /api/rss/decisions               Filtered RSS feed for court decisions
  //   GET  /api/rss/news                    RSS feed for published news posts
  //   POST /api/subscribe                   Email subscription creation
  //   GET  /api/unsubscribe                 Email unsubscription
  //   GET  /api/v1/decisions                Public API — paginated decisions
  //   GET  /api/v1/decisions/:id            Public API — single decision with full text
  //   GET  /api/v1/experts                  Public API — expert witness directory
  //   GET  /api/v1/interpreters             Public API — interpreter directory
  //   GET  /api/v1/courts                   Public API — courts directory
  //   GET  /api/v1/statistics               Public API — aggregate counts
  //   GET  /sitemap.xml                    XML sitemap (all content)
  //   GET  /robots.txt                     Robots directive + sitemap pointer
  // ---------------------------------------------------------------------------

  // Root-level SEO endpoints — must be before Payload catch-all
  app.use('/', createRobotsRouter())
  app.use('/', createSitemapRouter(payload))

  app.use('/api', contactRouter)
  app.use('/api', courtFeeRouter)
  app.use('/api', createDecisionsSearchRouter(payload))
  app.use('/api', createHybridSearchRouter(payload))
  app.use('/api', createGlobalSearchRouter(payload))
  app.use('/api', createJurisdictionRouter(payload))
  app.use('/api', createRssRouter(payload))
  app.use('/api', createPdfExportRouter(payload))
  app.use('/api', createSubscribeRouter(payload))
  app.use('/api', createStatisticsRouter(payload))
  app.use('/api', createChatRouter(payload))
  app.use('/api', createChatFeedbackRouter(payload))
  app.use('/api', createPublicApiRouter(payload))

  startNotificationDigest(payload)

  // ---------------------------------------------------------------------------
  // Payload REST API + Admin catch-all — Payload 3 uses the Web Fetch API.
  // We bridge Express req/res to Fetch Request/Response so that Payload's own
  // REST endpoints (/api/<collection>) and the Admin UI (/admin) are served.
  // ---------------------------------------------------------------------------
  app.use(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${process.env.PORT || '4094'}`)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value != null) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    let body: BodyInit | undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body)
    }
    const fetchReq = new Request(url.toString(), { method: req.method, headers, body })
    const response = await handleEndpoints({ config, request: fetchReq })
    res.status(response.status)
    response.headers.forEach((value, key) => res.setHeader(key, value))
    const buf = Buffer.from(await response.arrayBuffer())
    res.send(buf)
  })

  const port = parseInt(process.env.PORT || '4094', 10)

  app.listen(port, () => {
    payload.logger.info(`CMS server listening on port ${port}`)
  })
}

start()
