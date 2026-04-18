import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Pagination } from '@/components/ui/Pagination'

interface Decision {
  id: number
  title: string
  date: string
  caseNumber?: string
  celex?: string
  externalUrl?: string
  court?: { name: string }
}

export default function ECJDecisionsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('decisionsECJ')
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/court-decisions?where[court.type][equals]=ecj&limit=20&page=${page}&sort=-date`)
      .then(r => r.json())
      .then(d => { setDecisions(d.docs || []); setTotal(d.totalDocs || 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [page])

  // CURIA-filtered URL for Croatia ECJ cases. Useful fallback while our
  // in-DB ECJ ingest pipeline is being completed.
  const curiaCroatiaUrl = 'https://curia.europa.eu/juris/liste.jsf?language=en&ms=hr'

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('decisions.ecj.title', 'ECJ Decisions') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('decisions.ecj.title', 'ECJ Decisions')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('decisions.ecj.description', 'Decisions from the Court of Justice of the European Union (Sud Europske unije) that name or affect Croatia.')}
      </p>

      {loading ? (
        <div className="animate-pulse h-40 bg-[color:var(--color-surface-subtle)] rounded" />
      ) : decisions.length === 0 ? (
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] p-6">
          <p className="text-[color:var(--color-text)] mb-3">
            {t('decisions.ecj.emptyTitle', 'ECJ decisions for Croatia are not yet available in our database.')}
          </p>
          <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
            {t('decisions.ecj.emptyBody', 'The daily import pipeline is being finalised. In the meantime, search the official Court database at CURIA.')}
          </p>
          <a
            href={curiaCroatiaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t('decisions.ecj.viewOnCuria', 'View Croatia cases on CURIA')}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
            {t('decisions.ecj.count', '{{n}} decisions', { n: total })}
          </p>
          <div className="space-y-3">
            {decisions.map(d => (
              <Link
                key={d.id}
                to={`/${locale}/sudska-praksa/${d.id}`}
                className="block bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors"
              >
                <h3 className="font-semibold text-[color:var(--color-heading)]">{d.title}</h3>
                <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                  {d.caseNumber && <span className="font-mono">{d.caseNumber}</span>}
                  {d.caseNumber && ' · '}
                  {d.court?.name ?? ''}{d.court?.name && ' · '}
                  {d.date?.split('T')[0]}
                </p>
              </Link>
            ))}
            {total > 20 && <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />}
          </div>
        </div>
      )}
    </div>
  )
}
