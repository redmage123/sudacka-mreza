import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { getCourts, type CourtType } from '@/api/courts'
import type { Court, PayloadList } from '@/api/types'

// Tab types shown in the UI
const COURT_TYPES: Array<{ value: CourtType; labelKey: string }> = [
  { value: 'municipal', labelKey: 'courts.tab.opcinski' },
  { value: 'county', labelKey: 'courts.tab.zupanijski' },
  { value: 'commercial', labelKey: 'courts.tab.trgovacki' },
  { value: 'misdemeanour', labelKey: 'courts.tab.prekrsajni' },
]

// Map all CMS court type enum values → translation key for the badge on each card.
// Note: court names and addresses are official Croatian names stored as-is in the CMS.
// The surrounding UI (type badge, field labels) is fully translated.
const COURT_TYPE_LABEL: Record<string, string> = {
  municipal: 'courts.tab.opcinski',
  county: 'courts.tab.zupanijski',
  commercial: 'courts.tab.trgovacki',
  misdemeanour: 'courts.tab.prekrsajni',
  high_commercial: 'courts.tab.highCommercial',
  supreme: 'courts.tab.vrhovni',
  administrative: 'courts.tab.upravni',
  constitutional: 'courts.tab.ustavni',
  echr: 'courts.tab.echr',
}

function CourtCard({
  court,
  locale,
  t,
}: {
  court: Court
  locale: string
  t: (key: string) => string
}) {
  const typeLabelKey = court.type ? COURT_TYPE_LABEL[court.type] : undefined

  return (
    <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/${locale}/sudovi/${court.id}`}
              className="font-medium text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
            >
              {court.name}
            </Link>
            {typeLabelKey && (
              <span className="text-xs rounded-full bg-[color:var(--color-surface-alt)] text-[color:var(--color-text-muted)] px-2 py-0.5">
                {t(typeLabelKey)}
              </span>
            )}
          </div>
          {/* Metadata with translated field labels */}
          <dl className="text-sm text-[color:var(--color-text-muted)] mt-1.5 space-y-0.5">
            {court.address && (
              <div className="flex gap-1.5">
                <dt className="font-medium shrink-0">{t('courts.fields.address')}:</dt>
                <dd>{court.address}</dd>
              </div>
            )}
            {court.phone && (
              <div className="flex gap-1.5">
                <dt className="font-medium shrink-0">{t('courts.fields.phone')}:</dt>
                <dd>{court.phone}</dd>
              </div>
            )}
            {court.president && (
              <div className="flex gap-1.5">
                <dt className="font-medium shrink-0">{t('courts.fields.president')}:</dt>
                <dd>{court.president}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}

export default function CourtsPage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [searchParams, setSearchParams] = useSearchParams()
  const activeType = (searchParams.get('type') as CourtType | null) ?? 'municipal'
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [results, setResults] = useState<PayloadList<Court> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    getCourts({ type: activeType, page, locale })
      .then((data) => {
        if (isMounted.current) {
          setResults(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setError(true)
          setLoading(false)
        }
      })
  }, [activeType, page, locale])

  function handleTabClick(type: CourtType) {
    setSearchParams({ type, page: '1' }, { replace: true })
  }

  function handlePageChange(p: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('courts.searchTitle') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-6">
        {t('courts.searchTitle')}
      </h1>

      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label={t('courts.searchTitle')}
        className="flex border-b border-[color:var(--color-border)] mb-6 overflow-x-auto"
      >
        {COURT_TYPES.map((ct) => {
          const isActive = activeType === ct.value
          return (
            <button
              key={ct.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(ct.value)}
              className={[
                'px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)]',
                isActive
                  ? 'border-[color:var(--color-brand-navy)] text-[color:var(--color-heading)]'
                  : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
              ].join(' ')}
            >
              {t(ct.labelKey)}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} height="h-20" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="error">{t('error')}</Alert>
      )}

      {!loading && !error && results && (
        <>
          {results.totalDocs === 0 ? (
            <p className="text-[color:var(--color-text-muted)] py-8 text-center">
              {t('courts.noResults')}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {results.docs.map((court) => (
                  <CourtCard key={court.id} court={court} locale={locale} t={t} />
                ))}
              </div>
              <div className="mt-6 flex justify-center">
                <Pagination
                  page={page}
                  totalPages={results.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
