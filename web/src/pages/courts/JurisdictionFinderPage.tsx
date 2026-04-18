import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { PayloadListSchema, CourtSchema, type Court } from '@/api/types'

type JurisdictionCaseType =
  | 'civilMinor'
  | 'civilMajor'
  | 'criminalMinor'
  | 'criminalSerious'
  | 'commercial'
  | 'misdemeanour'
  | 'administrative'

const CASE_TYPE_TO_COURT: Record<JurisdictionCaseType, string> = {
  civilMinor: 'municipal',
  civilMajor: 'county',
  criminalMinor: 'municipal',
  criminalSerious: 'county',
  commercial: 'commercial',
  misdemeanour: 'misdemeanour',
  administrative: 'administrative',
}

const CASE_TYPES: Array<{ value: JurisdictionCaseType; labelKey: string }> = [
  { value: 'civilMinor', labelKey: 'jurisdictionFinder.caseType.civilMinor' },
  { value: 'civilMajor', labelKey: 'jurisdictionFinder.caseType.civilMajor' },
  { value: 'criminalMinor', labelKey: 'jurisdictionFinder.caseType.criminalMinor' },
  { value: 'criminalSerious', labelKey: 'jurisdictionFinder.caseType.criminalSerious' },
  { value: 'commercial', labelKey: 'jurisdictionFinder.caseType.commercial' },
  { value: 'misdemeanour', labelKey: 'jurisdictionFinder.caseType.misdemeanour' },
  { value: 'administrative', labelKey: 'jurisdictionFinder.caseType.administrative' },
]

const CROATIAN_CITIES = [
  'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula', 'Slavonski Brod',
  'Karlovac', 'Varaždin', 'Šibenik', 'Sisak', 'Vinkovci', 'Vukovar', 'Bjelovar',
  'Koprivnica', 'Požega', 'Čakovec', 'Dubrovnik', 'Gospić', 'Makarska',
  'Petrinja', 'Samobor', 'Velika Gorica', 'Zaprešić', 'Kaštela', 'Solin',
  'Trogir', 'Sinj', 'Virovitica', 'Đakovo', 'Kutina',
]

export default function JurisdictionFinderPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('jurisdictionFinder')

  const [allCourts, setAllCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const isMounted = useRef(true)

  const [city, setCity] = useState('')
  const [caseType, setCaseType] = useState<JurisdictionCaseType>('civilMinor')
  const [searched, setSearched] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    apiFetch('/courts', PayloadListSchema(CourtSchema), {
      params: { limit: 400, depth: 0 },
    })
      .then((data) => {
        if (isMounted.current) {
          setAllCourts(data.docs)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setError(true)
          setLoading(false)
        }
      })
  }, [])

  const results = useMemo(() => {
    if (!searched || !city.trim()) return []
    const courtType = CASE_TYPE_TO_COURT[caseType]
    const needle = city.trim().toLowerCase()
    return allCourts.filter((c) => {
      if (c.type !== courtType) return false
      const cityMatch =
        c.county?.toLowerCase().includes(needle) ||
        (c.address as string | undefined)?.toLowerCase().includes(needle) ||
        c.name.toLowerCase().includes(needle)
      return cityMatch
    })
  }, [searched, city, caseType, allCourts])

  function handleCityInput(value: string) {
    setCity(value)
    setSearched(false)
    if (value.length >= 2) {
      const filtered = CROATIAN_CITIES.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase()),
      )
      setSuggestions(filtered.slice(0, 8))
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  function selectSuggestion(suggestion: string) {
    setCity(suggestion)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearched(true)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('courts.searchTitle'), href: `/${locale}/sudovi` },
          { label: t('jurisdictionFinder.title') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">
        {t('jurisdictionFinder.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-8">
        {t('jurisdictionFinder.description')}
      </p>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="error">{t('map.error')}</Alert>
      )}

      {!loading && !error && (
        <>
          <form onSubmit={handleSearch} className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-[color:var(--color-heading)] mb-2">
                {t('jurisdictionFinder.cityLabel')}
              </label>
              <div className="relative">
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => handleCityInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={t('jurisdictionFinder.cityPlaceholder')}
                  autoComplete="off"
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className="w-full text-left px-4 py-2 text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-bg-card)] transition-colors"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="jurisdictionCaseType" className="block text-sm font-medium text-[color:var(--color-heading)] mb-2">
                {t('jurisdictionFinder.caseTypeLabel')}
              </label>
              <select
                id="jurisdictionCaseType"
                value={caseType}
                onChange={(e) => {
                  setCaseType(e.target.value as JurisdictionCaseType)
                  setSearched(false)
                }}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
              >
                {CASE_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {t(ct.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!city.trim()}
              className="rounded-lg bg-[color:var(--color-primary)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('jurisdictionFinder.find')}
            </button>
          </form>

          {/* Results */}
          {searched && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
                {t('jurisdictionFinder.result')}
              </h2>

              {results.length === 0 ? (
                <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6">
                  <p className="text-[color:var(--color-text-muted)] mb-3">
                    {t('jurisdictionFinder.noResult')}
                  </p>
                  <Link
                    to={`/${locale}/sudovi`}
                    className="inline-block text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                  >
                    {t('jurisdictionFinder.browseAll')} →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((court) => (
                    <div
                      key={court.id}
                      className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
                    >
                      <p className="font-medium text-[color:var(--color-heading)]">{court.name}</p>
                      <div className="text-sm text-[color:var(--color-text-muted)] mt-1 space-y-0.5">
                        {court.address && <p>{court.address}</p>}
                        {court.phone && <p>{court.phone}</p>}
                      </div>
                      <Link
                        to={`/${locale}/sudovi/${court.id}`}
                        className="inline-block mt-2 text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                      >
                        {t('jurisdictionFinder.viewProfile')} →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
