import { randomUUID } from 'crypto'
import { Router, Request, Response } from 'express'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Rate limiting: simple in-memory map keyed by IP → array of timestamps
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 5

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) return false
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const subscribeSchema = z.object({
  email: z.string().email('Nevažeća e-mail adresa.'),
  subscription_type: z.enum(['decisions', 'news', 'experts']),
  filters: z
    .object({
      court: z.string().optional(),
      category: z.string().optional(),
      keyword: z.string().optional(),
    })
    .optional(),
  frequency: z.enum(['daily', 'weekly']),
})

export function createSubscribeRouter(payload: any) {
  const router = Router()

  // -------------------------------------------------------------------------
  // POST /subscribe — Create a new email subscription
  // -------------------------------------------------------------------------
  router.post('/subscribe', async (req: Request, res: Response) => {
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'unknown')

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Previše zahtjeva. Pokušajte ponovo za minutu.' })
    }

    const parsed = subscribeSchema.safeParse(req.body)
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Nevažeći podaci.'
      return res.status(400).json({ error: message })
    }

    const { email, subscription_type, filters, frequency } = parsed.data

    try {
      await payload.create({
        collection: 'subscriptions',
        data: {
          email,
          subscription_type,
          filters: filters ?? {},
          frequency,
          confirmed: true,
          token: randomUUID(),
        },
      })

      return res.status(201).json({ ok: true, message: 'Pretplata je uspješno kreirana.' })
    } catch (err: any) {
      // Detect unique constraint violation on email
      const message = String(err?.message ?? '')
      if (
        message.toLowerCase().includes('unique') ||
        message.toLowerCase().includes('duplicate') ||
        (err?.code && (err.code === '23505' || err.code === 'P2002'))
      ) {
        return res.status(409).json({ error: 'Već ste pretplaćeni s ovom adresom.' })
      }
      payload.logger.error('Subscribe error:', err)
      return res.status(500).json({ error: 'Interna greška servera.' })
    }
  })

  // -------------------------------------------------------------------------
  // GET /unsubscribe — Remove a subscription by token
  // -------------------------------------------------------------------------
  router.get('/unsubscribe', async (req: Request, res: Response) => {
    const tokenParam = typeof req.query.token === 'string' ? req.query.token.trim() : ''

    if (!tokenParam) {
      return res.status(400).json({ error: 'Token je obavezan.' })
    }

    try {
      const result = await payload.find({
        collection: 'subscriptions',
        where: { token: { equals: tokenParam } },
        limit: 1,
      })

      if (!result.docs || result.docs.length === 0) {
        return res.status(404).json({ error: 'Pretplata nije pronađena.' })
      }

      const sub = result.docs[0] as any
      await payload.delete({
        collection: 'subscriptions',
        id: sub.id,
      })

      return res.status(200).json({ ok: true, message: 'Uspješno ste se odjavili.' })
    } catch (err) {
      payload.logger.error('Unsubscribe error:', err)
      return res.status(500).json({ error: 'Interna greška servera.' })
    }
  })

  return router
}
