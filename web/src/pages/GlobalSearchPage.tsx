import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function GlobalSearchPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('search')
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/court-decisions?where[title][contains]=${encodeURIComponent(query)}&limit=10`).then(r => r.json()).then(d => (d.docs || []).map((doc: any) => ({ ...doc, _type: 'decision' }))),
      fetch(`/api/courts?where[name][contains]=${encodeURIComponent(query)}&limit=10`).then(r => r.json()).then(d => (d.docs || []).map((doc: any) => ({ ...doc, _type: 'court' }))),
      fetch(`/api/judges?where[name][contains]=${encodeURIComponent(query)}&limit=10`).then(r => r.json()).then(d => (d.docs || []).map((doc: any) => ({ ...doc, _type: 'judge' }))),
    ])
    .then(([decisions, courts, judges]) => { setResults([...courts, ...judges, ...decisions]); setLoading(false) })
    .catch(() => setLoading(false))
  }, [query])

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('search.title', 'Search') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">{t('search.title', 'Search')}</h1>
      {query && <p className="text-[color:var(--color-text-muted)] mb-6">{t('search.resultsFor', { query, count: results.length })}</p>}
      {loading ? <div className="animate-pulse h-40 bg-[color:var(--color-surface-subtle)] rounded" /> :
       results.length === 0 && query ? <p className="text-center py-12 text-[color:var(--color-text-muted)]">{t('noResults', 'No results found')}</p> :
       <div className="space-y-3">
        {results.map((r, i) => {
          const href = r._type === 'decision' ? `/${locale}/sudska-praksa/${r.id}` : r._type === 'court' ? `/${locale}/sudovi/${r.id}` : `/${locale}/suci/${r.id}`
          return (
            <Link key={i} to={href} className="block bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors">
              <span className="text-xs font-semibold uppercase text-[color:var(--color-brand-gold)] mr-2">{r._type}</span>
              <span className="font-semibold text-[color:var(--color-heading)]">{r.name || r.title}</span>
              {r.date && <span className="text-xs text-[color:var(--color-text-muted)] ml-2">{r.date.split('T')[0]}</span>}
            </Link>
          )
        })}
       </div>
      }
    </div>
  )
}
