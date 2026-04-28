/**
 * POST /api/chat-feedback
 *
 * Captures human reinforcement feedback on a chat assistant answer:
 *   - 👍 / 👎 verdict
 *   - Optional written correction (the answer the assistant should have given)
 *   - Snapshot of the original question, model answer, lang, and citations
 *
 * Anonymous-friendly: a logged-in user is recorded if present, otherwise
 * `user` is null. Anonymous + logged-in are both rate-limited per IP so a
 * misbehaving client can't flood the table.
 */
import { Router, type Request, type Response } from 'express'
import type { Payload } from 'payload'

const buckets = new Map<string, { tokens: number; last: number }>()
const RATE_CAPACITY = 20
const RATE_REFILL_PER_MIN = 12

function takeToken(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip) ?? { tokens: RATE_CAPACITY, last: now }
  const elapsedMin = (now - b.last) / 60_000
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + elapsedMin * RATE_REFILL_PER_MIN)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}

interface FeedbackBody {
  conversationId?: string
  question?: string
  lang?: string
  modelAnswer?: string
  modelVersion?: string
  citations?: unknown
  verdict?: 'good' | 'bad'
  correction?: string
  reason?: string
}

export function createChatFeedbackRouter(payload: Payload): Router {
  const router = Router()

  router.post('/chat-feedback', async (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || 'unknown'
    if (!takeToken(ip)) {
      return res.status(429).json({ errors: [{ message: 'Rate limit — slow down a moment.' }] })
    }
    const body = (req.body ?? {}) as FeedbackBody
    const conversationId = (body.conversationId ?? '').toString().slice(0, 64).trim()
    const question = (body.question ?? '').toString().slice(0, 4000).trim()
    const lang = (body.lang ?? '').toString().slice(0, 5).trim().toLowerCase()
    const modelAnswer = (body.modelAnswer ?? '').toString().slice(0, 16000).trim()
    const verdict = body.verdict === 'good' || body.verdict === 'bad' ? body.verdict : null
    const correction = body.correction ? body.correction.toString().slice(0, 16000).trim() : undefined
    const reason = body.reason ? body.reason.toString().slice(0, 2000).trim() : undefined

    if (!conversationId || !question || !lang || !modelAnswer || !verdict) {
      return res
        .status(400)
        .json({ errors: [{ message: 'conversationId, question, lang, modelAnswer, verdict required' }] })
    }

    const userId =
      (req as Request & { user?: { id?: string } }).user?.id ?? undefined
    const userAgent = (req.headers['user-agent'] ?? '').toString().slice(0, 300)

    try {
      // Use payload.create with override-access so this row gets in even
      // though the collection's `create` access returns false for clients.
      await payload.create({
        collection: 'chat-feedback',
        data: {
          conversationId,
          question,
          lang,
          modelAnswer,
          modelVersion: body.modelVersion ?? process.env.LLM_MODEL ?? null,
          verdict,
          correction,
          reason,
          citations: body.citations ?? null,
          user: userId,
          ip,
          userAgent,
          status: 'pending',
        },
        overrideAccess: true,
      })
      res.json({ ok: true })
    } catch (e) {
      payload.logger.error({ err: e }, 'chat-feedback create failed')
      res.status(500).json({ errors: [{ message: 'Could not save feedback.' }] })
    }
  })

  return router
}
