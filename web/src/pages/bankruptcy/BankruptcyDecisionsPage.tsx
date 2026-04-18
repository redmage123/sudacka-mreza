import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'

interface Decision {
  id: number | string
  title: string
  date: string
  case_number?: string
  caseNumber?: string
  court?: { name: string } | null
  court_name?: string
}

export default function BankruptcyDecisionsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyDecisions')
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Hybrid search — backed by the GIN index, sub-second.
    // "stečaj" matches title + full_text_plain + search_vector.
    const qs = new URLSearchParams({
      q: 'stečaj',
      courtType: 'commercial',
      limit: '20',
      page: String(page),
    })
    fetch(`/api/decisions/hybrid-search?${qs.toString()}`)
      .then(r => r.json())
      .then(d => { setDecisions(d.docs || []); setTotal(d.totalDocs || 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
        { label: t('bankruptcy.decisions.title', 'Bankruptcy Decisions') },
      ]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('bankruptcy.decisions.title', 'Bankruptcy Decisions')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('bankruptcy.decisions.description', 'Court decisions related to bankruptcy proceedings in Croatia.')}
      </p>
      {loading ? (
        <div className="animate-pulse h-40 bg-[color:var(--color-surface-subtle)] rounded" />
      ) : decisions.length === 0 ? (
        <p className="text-center py-12 text-[color:var(--color-text-muted)]">{t('noResults', 'No results found')}</p>
      ) : (
        <div className="space-y-3">
          {decisions.map(d => {
            const courtName = d.court?.name ?? d.court_name ?? ''
            return (
              <Link
                key={d.id}
                to={`/${locale}/sudska-praksa/${d.id}`}
                className="block bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors"
              >
                <h3 className="font-semibold text-[color:var(--color-heading)]">{d.title}</h3>
                <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                  {courtName}{courtName && d.date ? ' · ' : ''}{d.date?.split('T')[0]}
                </p>
              </Link>
            )
          })}
          {total > 20 && <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />}
        </div>
      )}
    </div>
  )
}
