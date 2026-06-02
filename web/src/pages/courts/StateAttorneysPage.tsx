import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'
import { SearchBar } from '@/components/ui/SearchBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { getStateAttorneys, type StateAttorney } from '@/api/state-attorneys'
import type { PayloadList } from '@/api/types'

export default function StateAttorneysPage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const locale = lang ?? 'hr'

  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [results, setResults] = useState<PayloadList<StateAttorney> | null>(null)
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

  useEffect(() => {
    setLoading(true)
    setError(false)
    getStateAttorneys({ q: q || undefined, page, locale })
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
  }, [q, page, locale])

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
          { label: t('courts.searchTitle'), href: `/${locale}/sudovi` },
          { label: tn('stateAttorneys') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-6">
        {tn('stateAttorneys')}
      </h1>

      {/* Search bar */}
      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 mb-6">
        <SearchBar
          value={q}
          placeholder="Pretraži po imenu..."
          onChange={handleKeywordChange}
          aria-label={tn('stateAttorneys')}
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
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
              {t('noResults')}
            </p>
          ) : (
            <>
              <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
                Ukupno: {results.totalDocs.toLocaleString('hr-HR')} ureda
              </p>
              <div className="space-y-3">
                {results.docs.map((sa) => (
                  <Link
                    key={sa.id}
                    to={`/${locale}/sudovi/dorh/${sa.id}`}
                    className="block bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors group"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-[color:var(--color-text)]">{sa.name}</p>
                      <span className="text-sm text-[color:var(--color-text-link)] opacity-70 group-hover:opacity-100 whitespace-nowrap">
                        {t('viewDetails', 'Pogledaj detalje')} →
                      </span>
                    </div>
                    <div className="text-sm text-[color:var(--color-text-muted)] mt-1 space-x-3">
                      {sa.address && <span>{sa.address}</span>}
                      {sa.city && <span>{sa.city}</span>}
                      {sa.phone && <span>{sa.phone}</span>}
                    </div>
                  </Link>
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
