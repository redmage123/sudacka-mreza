import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { SearchBar } from '@/components/ui/SearchBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { getInterpreters } from '@/api/interpreters'
import type { PayloadList, Interpreter } from '@/api/types'

export default function InterpretersPage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const languagePair = searchParams.get('lang') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [results, setResults] = useState<PayloadList<Interpreter> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [languagePairOptions, setLanguagePairOptions] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      clearTimeout(debounceRef.current)
    }
  }, [])

  // Fetch all for language pair options
  useEffect(() => {
    getInterpreters({ locale, limit: 200 }).then((data) => {
      if (isMounted.current) {
        const all = data.docs.flatMap((i) => i.language_pairs)
        setLanguagePairOptions([...new Set(all)].sort())
      }
    }).catch(() => {/* non-critical */})
  }, [locale])

  // Search
  useEffect(() => {
    setLoading(true)
    setError(false)
    getInterpreters({
      q: q || undefined,
      languagePair: languagePair || undefined,
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
  }, [q, languagePair, page, locale])

  function handleKeywordChange(value: string) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (value) { params.set('q', value) } else { params.delete('q') }
      params.set('page', '1')
      setSearchParams(params, { replace: true })
    }, 300)
  }

  function handleFilterChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) { params.set(key, value) } else { params.delete(key) }
    params.set('page', '1')
    setSearchParams(params, { replace: true })
  }

  function handlePageChange(p: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-6">
        {t('interpreters.searchTitle')}
      </h1>

      {/* Filters */}
      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 mb-6 space-y-4">
        <SearchBar
          value={q}
          placeholder={t('interpreters.searchPlaceholder')}
          onChange={handleKeywordChange}
          aria-label={t('interpreters.searchTitle')}
        />

        <div>
          <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
            {t('interpreters.filterLanguage')}
          </label>
          <select
            value={languagePair}
            onChange={(e) => handleFilterChange('lang', e.target.value)}
            className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
          >
            <option value="">{t('interpreters.filterLanguageAll')}</option>
            {languagePairOptions.map((lp) => (
              <option key={lp} value={lp}>{lp}</option>
            ))}
          </select>
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
          {results.totalDocs === 0 ? (
            <p className="text-[color:var(--color-text-muted)] py-8 text-center">
              {t('interpreters.noResults')}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {results.docs.map((interp) => (
                  <div
                    key={interp.id}
                    className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/${locale}/strucnjaci/tumaci/${interp.id}`}
                          className="font-medium text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
                        >
                          {interp.name}
                        </Link>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {interp.language_pairs.map((lp) => (
                            <Badge key={lp} variant="info">{lp}</Badge>
                          ))}
                        </div>
                      </div>
                      {interp.verified === true && (
                        <Badge variant="success">{t('verified')}</Badge>
                      )}
                    </div>
                  </div>
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
