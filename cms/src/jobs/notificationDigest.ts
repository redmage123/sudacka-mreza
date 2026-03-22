import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const BASE_URL = (process.env.SERVER_URL ?? 'https://sudacka-mreza.hr').replace(/\/$/, '')

async function runDigest(payload: any): Promise<void> {
  try {
    const subscriptionsResult = await payload.find({
      collection: 'subscriptions',
      where: { confirmed: { equals: true } },
      limit: 1000,
    })

    const subscriptions: any[] = subscriptionsResult.docs

    for (const subscription of subscriptions) {
      try {
        const now = new Date()
        const frequency: string = subscription.frequency ?? 'daily'

        // Determine "since" cutoff
        let since: Date
        if (frequency === 'weekly') {
          // Only send on Mondays
          if (now.getDay() !== 1) continue
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        } else {
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }

        const subscriptionType: string = subscription.subscription_type
        const filters = subscription.filters ?? {}

        let newItems: any[] = []
        let itemLines: string[] = []

        if (subscriptionType === 'decisions') {
          const where: Record<string, any> = {
            date: { greater_than: since.toISOString() },
          }

          // Court filter: resolve court name to IDs
          if (filters.court) {
            const courtsResult = await payload.find({
              collection: 'courts',
              where: { name: { contains: filters.court } },
              limit: 100,
            })
            const courtIds = (courtsResult.docs as any[]).map((c: any) => c.id)
            if (courtIds.length > 0) {
              where['court'] = { in: courtIds }
            }
          }

          if (filters.category) {
            where['decisionType'] = { equals: filters.category }
          }

          if (filters.keyword) {
            where['searchVector'] = { contains: filters.keyword }
          }

          const decisionsResult = await payload.find({
            collection: 'court-decisions',
            where,
            limit: 10,
            sort: '-date',
          })
          newItems = decisionsResult.docs

          itemLines = newItems.map((doc: any) => {
            const id = String(doc.id)
            const slug = String(doc.slug ?? '')
            const title = [doc.caseNumber, doc.title].filter(Boolean).join(' — ')
            const link = `${BASE_URL}/hr/sudska-praksa/${id}-${slug}`
            return `- ${title}\n  ${link}`
          })
        } else if (subscriptionType === 'news') {
          const newsResult = await payload.find({
            collection: 'news-posts',
            where: {
              publishedAt: { greater_than: since.toISOString() },
            },
            limit: 10,
            sort: '-publishedAt',
          })
          newItems = newsResult.docs

          itemLines = newItems.map((doc: any) => {
            const slug = String(doc.slug ?? '')
            const link = `${BASE_URL}/hr/vijesti/${slug}`
            return `- ${doc.title ?? slug}\n  ${link}`
          })
        } else {
          // experts — no new content tracking yet
          continue
        }

        if (newItems.length === 0) continue

        const unsubscribeLink = `${BASE_URL}/odjava?token=${subscription.token}`
        const body = [
          'Poštovani,',
          '',
          'Ovo su novi sadržaji na portalu Sudačka mreža:',
          '',
          ...itemLines,
          '',
          '---',
          `Za odjavu s pretplate posjetite: ${unsubscribeLink}`,
          '',
          'Sudačka mreža',
        ].join('\n')

        await resend.emails.send({
          from: 'Sudačka Mreža <noreply@sudacka-mreza.hr>',
          to: subscription.email,
          subject: 'Sudačka mreža — novi sadržaj',
          text: body,
        })

        await payload.update({
          collection: 'subscriptions',
          id: subscription.id,
          data: { lastNotifiedAt: new Date().toISOString() },
        })
      } catch (subErr) {
        payload.logger.error(`Digest error for subscription ${subscription.id}:`, subErr)
      }
    }
  } catch (err) {
    payload.logger.error('Notification digest error:', err)
  }
}

export function startNotificationDigest(payload: any): void {
  // Wait 24h before first run — do not fire immediately on startup
  setInterval(() => {
    void runDigest(payload)
  }, 24 * 60 * 60 * 1000)
}
