/**
 * POST /api/legal-ai/ask
 *
 * Server-side proxy to the Sudačka Mreža Legal Q&A pipeline that lives on the
 * dev/GPU host.  The pipeline (retrieve → confidence gate → v3-robust LLM →
 * regex + NLI verifier) produces an answer plus its supporting passages.
 * This route hides the bearer token from the client and rate-limits.
 *
 * Accuracy is the contract: the API never returns an answer without its
 * sources attached.  See /home/bbrelin/sudacka-finetune/scripts/22_pipeline.py
 * and the eval at logs/eval/pipeline/ for the faithfulness numbers.
 *
 * Env:
 *   LEGAL_AI_ENDPOINT  upstream URL (e.g. http://176.9.99.103:8190)
 *   LEGAL_AI_TOKEN     bearer token for that upstream
 */

import { Router, Request, Response } from 'express'

const UPSTREAM = process.env.LEGAL_AI_ENDPOINT || 'http://176.9.99.103:8190'
const TOKEN = process.env.LEGAL_AI_TOKEN || ''

// Very simple per-IP in-memory rate limit: 20 requests / 10 minutes.
// For production scale, move this to Redis.
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 20
const buckets = new Map<string, { t: number; n: number }>()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now - b.t > RATE_WINDOW_MS) {
    buckets.set(ip, { t: now, n: 1 })
    return true
  }
  if (b.n >= RATE_MAX) return false
  b.n += 1
  return true
}

export function createLegalAiRouter() {
  const router = Router()

  if (!TOKEN) {
    console.warn('LEGAL_AI_TOKEN not set — /api/legal-ai/ask will return 503')
  }

  router.post('/legal-ai/ask', async (req: Request, res: Response) => {
    if (!TOKEN) {
      return res.status(503).json({ error: 'legal AI not configured' })
    }

    const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString()
    if (!rateLimit(ip)) {
      return res.status(429).json({ error: 'previše upita — pokušajte ponovno za koju minutu' })
    }

    const question = (req.body?.question ?? '').toString().trim()
    const k = Number.isInteger(req.body?.k) ? req.body.k : undefined

    if (question.length < 3) {
      return res.status(400).json({ error: 'pitanje mora imati najmanje 3 znaka' })
    }
    if (question.length > 2000) {
      return res.status(400).json({ error: 'pitanje je predugačko (maks. 2000 znakova)' })
    }

    try {
      const upstream = await fetch(`${UPSTREAM}/ask`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ question, k }),
        // Pipeline with NLI can take ~25s on longer answers; allow generous
        // timeout so we don't prematurely abort correct answers.
        signal: AbortSignal.timeout(120_000),
      })
      if (!upstream.ok) {
        const text = await upstream.text()
        return res.status(502).json({
          error: 'pravni asistent trenutno nije dostupan',
          upstream_status: upstream.status,
          detail: text.slice(0, 500),
        })
      }
      const data = await upstream.json()
      // Strip raw retrieval scores from the client response — internal only.
      if (data?.retrieval?.top_hits) {
        delete data.retrieval.top_hits
      }
      return res.json(data)
    } catch (err: any) {
      console.error('legal-ai proxy error', err)
      return res.status(502).json({
        error: 'pravni asistent trenutno nije dostupan',
        detail: err?.message || String(err),
      })
    }
  })

  return router
}
