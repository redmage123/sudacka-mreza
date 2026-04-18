import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const IdSchema = z.union([z.string(), z.number()]).transform(String)

const ListingSchema = z.object({
  id: IdSchema,
  caseNumber: z.string().nullable().optional(),
  debtorName: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  court: z
    .object({ id: IdSchema, name: z.string().optional(), city: z.string().nullable().optional() })
    .nullable()
    .optional(),
  administrator: z
    .object({ id: IdSchema, name: z.string().optional() })
    .nullable()
    .optional(),
  assets: z
    .object({
      value_eur: z.number().nullable().optional(),
      value_raw: z.string().nullable().optional(),
      auction_date: z.string().nullable().optional(),
      court_name: z.string().nullable().optional(),
      assets_description: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      show_id: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
})
type Listing = z.infer<typeof ListingSchema>

export default function BankruptcyListingDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyDetail')

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    apiFetch(`/bankruptcy-listings/${id}`, ListingSchema, { params: { locale } })
      .then((d) => {
        if (!mounted.current) return
        setListing(d)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [id, locale])

  function formatDate(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale)
    } catch {
      return iso
    }
  }

  const title = listing?.debtorName ?? t('bankruptcy.listingDetail.title', 'Bankruptcy Proceeding')

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
        { label: t('bankruptcy.listings.title', 'Bankruptcy Listings'), href: `/${locale}/stecaj/oglasi` },
        { label: `#${id}` },
      ]} />
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-6">
        {title}
      </h1>

      {loading && <Skeleton className="h-64 w-full rounded-lg" />}
      {error && <Alert variant="error">{t('bankruptcy.listingDetail.loadError', 'Could not load bankruptcy listing.')}</Alert>}

      {!loading && !error && listing && (
        <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] rounded-lg border border-[color:var(--color-border)] p-6 space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {listing.caseNumber && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.caseNumber', 'Case number')}</dt>
                <dd className="font-mono text-[color:var(--color-text)]">{listing.caseNumber}</dd>
              </div>
            )}
            {listing.status && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.status', 'Status')}</dt>
                <dd className="text-[color:var(--color-text)] capitalize">{listing.status}</dd>
              </div>
            )}
            {listing.court?.name && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.court', 'Court')}</dt>
                <dd>
                  <Link to={`/${locale}/sudovi/${listing.court.id}`} className="text-[color:var(--color-brand)] hover:underline">
                    {listing.court.name}
                  </Link>
                </dd>
              </div>
            )}
            {listing.administrator?.name && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.administrator', 'Administrator')}</dt>
                <dd className="text-[color:var(--color-text)]">{listing.administrator.name}</dd>
              </div>
            )}
            {listing.deadline && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.deadline', 'Deadline')}</dt>
                <dd className="text-[color:var(--color-text)]">{formatDate(listing.deadline)}</dd>
              </div>
            )}
            {listing.assets?.auction_date && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.auctionDate', 'Auction date')}</dt>
                <dd className="text-[color:var(--color-text)]">{listing.assets.auction_date}</dd>
              </div>
            )}
            {listing.assets?.value_raw && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.value', 'Asset value')}</dt>
                <dd className="text-[color:var(--color-text)]">{listing.assets.value_raw}</dd>
              </div>
            )}
            {(listing.contactEmail || listing.contactPhone) && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.contact', 'Contact')}</dt>
                <dd className="text-[color:var(--color-text)]">
                  {listing.contactEmail && <div>{listing.contactEmail}</div>}
                  {listing.contactPhone && <div>{listing.contactPhone}</div>}
                </dd>
              </div>
            )}
            {listing.publishedAt && (
              <div>
                <dt className="font-medium text-[color:var(--color-text-muted)]">{t('bankruptcy.listingDetail.publishedAt', 'Published')}</dt>
                <dd className="text-[color:var(--color-text)]">{formatDate(listing.publishedAt)}</dd>
              </div>
            )}
          </dl>

          {listing.assets?.assets_description && (
            <div>
              <dt className="font-medium text-[color:var(--color-text-muted)] text-sm">{t('bankruptcy.listingDetail.assetsDescription', 'Assets')}</dt>
              <dd className="text-[color:var(--color-text)] whitespace-pre-wrap mt-1">{listing.assets.assets_description}</dd>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
