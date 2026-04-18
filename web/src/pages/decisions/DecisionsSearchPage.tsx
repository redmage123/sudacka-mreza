import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'
import { SearchBar } from '@/components/ui/SearchBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { searchDecisions, getCourts_forFilter } from '@/api/court-decisions'
import { formatDate } from '@/utils/dates'
import type { CourtDecisionSummary, PayloadList } from '@/api/types'

export default function DecisionsSearchPage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const court = searchParams.get('court') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const type = searchParams.get('type') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [courtOptions, setCourtOptions] = useState<string[]>([])
  const [results, setResults] = useState<PayloadList<CourtDecisionSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      clearTimeout(debounceRef.current)
    }
  }, [])

  // Load court options once
  useEffect(() => {
    getCourts_forFilter(locale).then((names) => {
      if (isMounted.current) setCourtOptions(names)
    }).catch(() => {/* non-critical */})
  }, [locale])

  // Search whenever URL params change
  useEffect(() => {
    setLoading(true)
    setError(false)
    searchDecisions({
      q: q || undefined,
      court: court || undefined,
      from: from || undefined,
      to: to || undefined,
      type: type || undefined,
      page,
      locale,
    })
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
  }, [q, court, from, to, type, page, locale])

  function handleKeywordChange(value: string) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      params.set('page', '1')
      setSearchParams(params, { replace: true })
    }, 300)
  }

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '1')
    setSearchParams(params, { replace: true })
  }

  function handleClearFilters() {
    setSearchParams({}, { replace: true })
  }

  function handlePageChange(p: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    setSearchParams(params, { replace: true })
  }

  const totalDocs = results?.totalDocs ?? 0
  const totalPages = results?.totalPages ?? 1
  const from1 = totalDocs === 0 ? 0 : (page - 1) * 20 + 1
  const to1 = Math.min(page * 20, totalDocs)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('nav.decisionsSearch') },
        ]}
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-6">
        {t('decisions.searchTitle')}
      </h1>

      {/* Filters */}
      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 mb-6 space-y-4">
        <SearchBar
          value={q}
          placeholder={t('decisions.searchPlaceholder')}
          onChange={handleKeywordChange}
          aria-label={t('decisions.searchTitle')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Court dropdown */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('decisions.filterCourt')}
            </label>
            <select
              value={court}
              onChange={(e) => handleFilterChange('court', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            >
              <option value="">{t('decisions.filterCourtAll')}</option>
              {courtOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('decisions.filterDateFrom')}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('decisions.filterDateTo')}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            />
          </div>

          {/* Decision type */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('decisions.filterType')}
            </label>
            <select
              value={type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            >
              <option value="">{t('decisions.type.all')}</option>
              <option value="VTS">{t('decisions.type.vts')}</option>
              <option value="ESLJP">{t('decisions.type.esljp')}</option>
              <option value="general">{t('decisions.type.general')}</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
          >
            {t('decisions.clearFilters')}
          </button>
        </div>
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
          {totalDocs === 0 ? (
            <p className="text-[color:var(--color-text-muted)] py-8 text-center">
              {t('decisions.noResults')}
            </p>
          ) : (
            <>
              <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
                {t('decisions.showingResults', { from: from1, to: to1, total: totalDocs })}
              </p>
              <div className="space-y-3">
                {results.docs.map((decision) => (
                  <div
                    key={decision.id}
                    className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/${locale}/sudska-praksa/${decision.id}`}
                          className="font-medium text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
                        >
                          {decision.title}
                        </Link>
                        <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                          {decision.court} · {decision.date ? formatDate(decision.date, lang) : ''}
                        </p>
                        {decision.excerpt && (
                          <p
                            className="text-sm text-[color:var(--color-text-muted)] mt-2 line-clamp-2
                                       [&_mark]:bg-yellow-100 [&_mark]:text-yellow-900 [&_mark]:rounded [&_mark]:px-0.5"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: decision.excerpt }}
                          />
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="neutral">{decision.decision_type ?? decision.decisionType}</Badge>
                        {decision.searchMode === 'semantic' && (
                          <span className="text-xs text-[color:var(--color-text-muted)] italic">
                            {t('decisions.semanticMatch')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-center">
                <Pagination
                  page={page}
                  totalPages={totalPages}
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
