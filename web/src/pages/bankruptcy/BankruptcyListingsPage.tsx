import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { apiFetch } from '@/api/client'
import {
  BankruptcyAdvancedSearch,
  type BankruptcyFilters,
} from '@/components/bankruptcy/BankruptcyAdvancedSearch'
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
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<BankruptcyFilters>(() => ({
    q: searchParams.get('q') ?? '',
    court: searchParams.get('court') ?? '',
    assetCategory: searchParams.get('assetCategory') ?? '',
    assetType: searchParams.get('assetType') ?? '',
    debtor: searchParams.get('debtor') ?? '',
    administrator: searchParams.get('administrator') ?? '',
    status: searchParams.get('status') ?? '',
  }))
  // Existing variables kept so the rest of the file (effects, render) still typechecks.
  const query = filters.q ?? ''
  const assetCategory = filters.assetCategory ?? ''
  const assetType = filters.assetType ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
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
    // status filter — defaults to 'active' when the search bar leaves it blank.
    params['where[status][equals]'] = filters.status || 'active'
    // REDESIGN 3.7.2 — "Pretraži u tekstu" matches case number, debtor name,
    // and the new structured description column.
    if (query) {
      params['where[or][0][debtorName][like]'] = query
      params['where[or][1][caseNumber][like]'] = query
      params['where[or][2][description][like]'] = query
    }
    if (assetCategory) params['where[assetCategory][equals]'] = assetCategory
    if (assetType) params['where[assetType][like]'] = assetType
    if (filters.court) params['where[court][equals]'] = filters.court
    if (filters.debtor) params['where[debtor][equals]'] = filters.debtor
    if (filters.administrator) params['where[administrator][equals]'] = filters.administrator
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
  }, [page, query, assetCategory, assetType, filters.court, filters.debtor, filters.administrator, filters.status, locale])

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

      <div className="mb-3">
        <BankruptcyAdvancedSearch
          mode="inline"
          initial={filters}
          onChange={(f) => { setFilters(f); setPage(1) }}
        />
      </div>
      <p className="mb-4 text-sm text-[color:var(--color-text-muted)]">
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
