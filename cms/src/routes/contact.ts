import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { sendContactEmail } from '../hooks/sendContactEmail.js'

const router = Router()

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 5 submissions per IP per hour → 6th returns 429
// (spec §6.5 & FR-028)
// ---------------------------------------------------------------------------
interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const MAX_PER_HOUR = 5
const WINDOW_MS = 60 * 60 * 1000 // 1 hour in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= MAX_PER_HOUR) {
    return false
  }

  entry.count += 1
  return true
}

// Periodically clean up expired entries to avoid memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart >= WINDOW_MS) {
      rateLimitStore.delete(ip)
    }
  }
}, WINDOW_MS)

// ---------------------------------------------------------------------------
// Validation schema (spec FR-028)
// ---------------------------------------------------------------------------
const contactSchema = z.object({
  name: z.string().min(1, 'Ime je obavezno'),
  email: z.string().email('Nevažeća email adresa'),
  subject: z.enum(['Prijedlog', 'Kritika', 'Suradnja', 'Mediji', 'Ostalo'], {
    errorMap: () => ({ message: 'Odaberite valjani predmet' }),
  }),
  message: z.string().min(20, 'Poruka mora imati najmanje 20 znakova'),
  honeypot: z.string().max(0).optional(),
})

// ---------------------------------------------------------------------------
// POST /api/contact
// ---------------------------------------------------------------------------
router.post('/contact', async (req: Request, res: Response) => {
  // Honeypot field populated → bot; silent success so as not to reveal detection
  if (req.body?.honeypot) {
    return res.json({ success: true })
  }

  // Rate limiting
  const ip = String(
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown',
  )

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Previše zahtjeva. Molimo pokušajte ponovo za sat vremena.',
    })
  }

  // Zod validation
  const result = contactSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ errors: result.error.flatten().fieldErrors })
  }

  const { name, email, subject, message } = result.data

  const sent = await sendContactEmail({ name, email, subject, message })
  if (!sent) {
    return res.status(500).json({
      error: 'Slanje poruke nije uspjelo. Molimo pokušajte ponovo.',
    })
  }

  return res.json({ success: true })
})

export default router
