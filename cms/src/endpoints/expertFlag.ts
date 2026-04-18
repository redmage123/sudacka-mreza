import type { PayloadHandler, PayloadRequest } from 'payload'
import type { CollectionSlug } from 'payload'

/**
 * POST /api/experts/:id/flag
 * Logged-in users can flag an expert-witness profile as inaccurate.
 *
 * POST /api/experts/:id/verify
 * Admin/Editor can mark a profile as verified.
 *
 * Also registered for interpreters:
 *   POST /api/interpreters/:id/flag
 *   POST /api/interpreters/:id/verify
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const flagHandler =
  (collectionSlug: CollectionSlug): PayloadHandler =>
  async (req: PayloadRequest): Promise<Response> => {
    const { id } = (req.routeParams ?? {}) as { id?: string }

    if (!req.user) {
      return json({ error: 'Morate biti prijavljeni.' }, 401)
    }

    const body = (req.data ?? {}) as { reason?: string }
    const reason = body.reason?.trim()
    if (!reason) {
      return json({ error: 'Razlog je obavezan.' }, 400)
    }

    const doc = await req.payload.findByID({
      collection: collectionSlug,
      id: id as string,
      depth: 0,
    })

    const existing = ((doc as any).flagReports ?? []) as Array<unknown>
    const newReport = {
      reporter: req.user.id,
      reason,
      date: new Date().toISOString(),
    }

    await req.payload.update({
      collection: collectionSlug,
      id: id as string,
      data: { flagReports: [...existing, newReport] } as any,
      overrideAccess: true,
    })

    return json({ success: true, message: 'Prijava je zaprimljena.' })
  }

export const verifyHandler =
  (collectionSlug: CollectionSlug): PayloadHandler =>
  async (req: PayloadRequest): Promise<Response> => {
    const { id } = (req.routeParams ?? {}) as { id?: string }

    if (!req.user) {
      return json({ error: 'Morate biti prijavljeni.' }, 401)
    }

    const role = (req.user as any).role as string | undefined
    if (role !== 'admin' && role !== 'editor') {
      return json({ error: 'Nemate ovlasti za verifikaciju.' }, 403)
    }

    await req.payload.update({
      collection: collectionSlug,
      id: id as string,
      data: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.user.id,
        lastConfirmed: new Date().toISOString(),
      } as any,
      overrideAccess: true,
    })

    return json({ success: true, message: 'Profil je verificiran.' })
  }
