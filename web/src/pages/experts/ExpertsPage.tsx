import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'
import { SearchBar } from '@/components/ui/SearchBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { getExpertWitnesses } from '@/api/expert-witnesses'
import { CROATIAN_COUNTIES } from '@/utils/counties'
import type { ExpertWitness, PayloadList } from '@/api/types'

export default function ExpertsPage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const speciality = searchParams.get('speciality') ?? ''
  const county = searchParams.get('county') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [allExperts, setAllExperts] = useState<ExpertWitness[]>([])
  const [results, setResults] = useState<PayloadList<ExpertWitness> | null>(null)
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

  // Fetch all for speciality options
  useEffect(() => {
    getExpertWitnesses({ locale, limit: 100 }).then((data) => {
      if (isMounted.current) setAllExperts(data.docs)
    }).catch(() => {/* non-critical */})
  }, [locale])

  // Deduplicated sorted speciality options
  const specialityOptions = useMemo(() => {
    const all = allExperts.flatMap((e) => e.speciality_areas)
    return [...new Set(all)].sort()
  }, [allExperts])

  // Search
  useEffect(() => {
    setLoading(true)
    setError(false)
    getExpertWitnesses({
      q: q || undefined,
      speciality: speciality || undefined,
      county: county || undefined,
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
  }, [q, speciality, county, page, locale])

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
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('experts.searchTitle') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-6">
        {t('experts.searchTitle')}
      </h1>

      {/* Filters */}
      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 mb-6 space-y-4">
        <SearchBar
          value={q}
          placeholder={t('experts.searchPlaceholder')}
          onChange={handleKeywordChange}
          aria-label={t('experts.searchTitle')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Speciality */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('experts.filterSpeciality')}
            </label>
            {/* TODO Sprint 6: upgrade to multi-select */}
            <select
              value={speciality}
              onChange={(e) => handleFilterChange('speciality', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            >
              <option value="">{t('experts.filterSpecialityAll')}</option>
              {specialityOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* County */}
          <div>
            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('experts.filterCounty')}
            </label>
            <select
              value={county}
              onChange={(e) => handleFilterChange('county', e.target.value)}
              className="w-full h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 text-sm focus:outline-none focus:border-[color:var(--color-border-focus)]"
            >
              <option value="">{t('experts.filterCountyAll')}</option>
              {CROATIAN_COUNTIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
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
              {t('experts.noResults')}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {results.docs.map((expert) => (
                  <div
                    key={expert.id}
                    className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/${locale}/strucnjaci/vjestaci/${expert.id}`}
                          className="font-medium text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
                        >
                          {expert.name}
                        </Link>
                        {expert.languages && expert.languages.length > 0 && (
                          <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                            {expert.languages.join(', ')}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {expert.speciality_areas.map((area) => (
                            <Badge key={area} variant="info">{area}</Badge>
                          ))}
                        </div>
                      </div>
                      {expert.verified === true && (
                        <Badge variant="verified">{t('verified')}</Badge>
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
