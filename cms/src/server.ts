import express from 'express'
import payload from 'payload'

// Custom route modules
import contactRouter from './routes/contact.js'
import courtFeeRouter from './routes/court-fee.js'
import { createDecisionsSearchRouter } from './routes/decisions-search.js'
import { createGlobalSearchRouter } from './routes/global-search.js'
import { createJurisdictionRouter } from './routes/jurisdiction.js'
import { createLegalAiRouter } from './routes/legal-ai.js'
import { createRssRouter } from './routes/rss.js'

const app = express()

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
  // Payload CMS init
  // ---------------------------------------------------------------------------
  await payload.init({
    secret: process.env.PAYLOAD_SECRET,
    express: app,
    onInit: () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`)
    },
  })

  // ---------------------------------------------------------------------------
  // Custom API routes — mounted AFTER Payload init so the payload instance
  // is available. All paths are under /api/ to sit beside Payload's own
  // /api/<collection-slug> REST endpoints.
  //
  //   POST /api/contact                     Contact form (rate-limited, Zod, Resend)
  //   GET  /api/decisions/search            Full-text search with ts_rank / ts_headline
  //   GET  /api/search                      Global search across all content types
  //   GET  /api/court-fee/calculate         Court fee calculator
  //   GET  /api/court-fee/types             Proceeding type list for UI dropdowns
  //   GET  /api/jurisdiction                Point-in-polygon jurisdiction lookup
  //   POST /api/legal-ai/ask                Retrieval-grounded Q&A over Croatian law
  //   GET  /api/rss/court-decisions.xml     RSS 2.0 feed (latest 50 decisions)
  // ---------------------------------------------------------------------------
  app.use('/api', contactRouter)
  app.use('/api', courtFeeRouter)
  app.use('/api', createDecisionsSearchRouter(payload))
  app.use('/api', createGlobalSearchRouter(payload))
  app.use('/api', createJurisdictionRouter(payload))
  app.use('/api', createLegalAiRouter())
  app.use('/api', createRssRouter(payload))

  const port = parseInt(process.env.PORT || '4094', 10)

  app.listen(port, () => {
    payload.logger.info(`CMS server listening on port ${port}`)
  })
}

start()
