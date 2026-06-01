import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
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
  court: z
    .object({ id: IdSchema, name: z.string().optional() })
    .nullable()
    .optional(),
  assets: z
    .object({
      value_eur: z.number().nullable().optional(),
      value_raw: z.string().nullable().optional(),
      auction_date: z.string().nullable().optional(),
      court_name: z.string().nullable().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
})
type Listing = z.infer<typeof ListingSchema>

const ListSchema = z.object({
  docs: z.array(ListingSchema),
  totalDocs: z.number(),
  totalPages: z.number().optional(),
  page: z.number().optional(),
})

const PAGE_SIZE = 20

export default function BankruptcyListingsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyListings')

  const [items, setItems] = useState<Listing[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [courtId, setCourtId] = useState('')
  const [adminId, setAdminId] = useState('')
  const [status, setStatus] = useState('active')
  // Filter dropdown options
  const [courtOpts, setCourtOpts] = useState<Array<{ id: string; name: string }>>([])
  const [adminOpts, setAdminOpts] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Load filter options once: commercial courts and bankruptcy administrators.
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/courts?where[type][equals]=commercial&limit=200&sort=name')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { docs: Array<{ id: string | number; name: string }> }) =>
          (d.docs ?? []).map(c => ({ id: String(c.id), name: c.name }))),
      fetch('/api/bankruptcy-administrators?limit=400&sort=name')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: { docs: Array<{ id: string | number; name: string }> }) =>
          (d.docs ?? []).map(a => ({ id: String(a.id), name: a.name }))),
    ])
      .then(([courts, admins]) => {
        if (!alive) return
        setCourtOpts(courts)
        setAdminOpts(admins)
      })
      .catch(() => { /* options stay empty; users can still text-search */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      page,
      locale,
      sort: '-publishedAt',
    }
    if (status) params['where[status][equals]'] = status
    if (query) params['where[debtorName][like]'] = query
    if (courtId) params['where[court][equals]'] = courtId
    if (adminId) params['where[administrator][equals]'] = adminId
    apiFetch('/bankruptcy-listings', ListSchema, { params })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setTotalDocs(d.totalDocs)
        setTotalPages(d.totalPages ?? 1)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [page, query, courtId, adminId, status, locale])

  function formatDeadline(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale)
    } catch {
      return iso
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
        { label: t('bankruptcy.listings.title', 'Bankruptcy Listings') },
      ]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('bankruptcy.listings.title', 'Bankruptcy Listings')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('bankruptcy.listings.description', 'Active bankruptcy proceedings published in the official gazette.')}
      </p>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[color:var(--color-text-muted)] mb-1">
            {t('bankruptcy.listings.filterDebtor', 'Stečajni dužnik')}
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder={t('bankruptcy.listings.searchPlaceholder', 'Pretraga po nazivu dužnika…')}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--color-text-muted)] mb-1">
            {t('bankruptcy.listings.filterCourt', 'Sud')}
          </label>
          <select
            value={courtId}
            onChange={(e) => { setCourtId(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]"
          >
            <option value="">{t('bankruptcy.listings.allCourts', 'Svi sudovi / All courts')}</option>
            {courtOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--color-text-muted)] mb-1">
            {t('bankruptcy.listings.filterAdmin', 'Stečajni upravitelj')}
          </label>
          <select
            value={adminId}
            onChange={(e) => { setAdminId(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]"
          >
            <option value="">{t('bankruptcy.listings.allAdmins', 'Svi upravitelji')}</option>
            {adminOpts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--color-text-muted)] mb-1">
            {t('bankruptcy.listings.filterStatus', 'Status')}
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)]"
          >
            <option value="">{t('bankruptcy.listings.allStatuses', 'Svi statusi')}</option>
            <option value="active">{t('bankruptcy.listings.statusActive', 'Aktivni')}</option>
            <option value="closed">{t('bankruptcy.listings.statusClosed', 'Zatvoreni')}</option>
            <option value="pending_review">{t('bankruptcy.listings.statusPending', 'U obradi')}</option>
          </select>
        </div>
      </div>
      <p className="-mt-3 mb-4 text-sm text-[color:var(--color-text-muted)]">
        {t('bankruptcy.listings.count', '{{n}} listings', { n: totalDocs })}
      </p>

      {error && <Alert variant="error">{t('bankruptcy.listings.loadError', 'Could not load bankruptcy listings.')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg font-medium text-[color:var(--color-text-muted)]">
            {t('bankruptcy.listings.empty', 'No active bankruptcy listings')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((l) => (
            <Link
              key={l.id}
              to={`/${locale}/stecaj/oglasi/${l.id}`}
              className="block bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[color:var(--color-heading)] truncate">
                    {l.debtorName ?? t('bankruptcy.listings.unknownDebtor', 'Unknown debtor')}
                  </h3>
                  <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                    {l.caseNumber && <span className="font-mono">{l.caseNumber}</span>}
                    {l.court?.name && <span> · {l.court.name}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {l.assets?.value_raw && (
                    <p className="text-sm font-medium text-[color:var(--color-heading)]">{l.assets.value_raw}</p>
                  )}
                  <p className="text-xs text-[color:var(--color-text-muted)] mt-1">
                    {t('bankruptcy.listings.deadline', 'Deadline')}: {formatDeadline(l.deadline)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      )}
    </div>
  )
}
