import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Skeleton } from '@/components/ui/Skeleton'
import { getJudgeById } from '@/api/judges'
import type { Judge } from '@/api/judges'

export default function JudgeDetailPage() {
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const locale = lang ?? 'hr'

  const [judge, setJudge] = useState<Judge | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    setNotFound(false)
    getJudgeById(id, locale)
      .then((data) => {
        setJudge(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number }).status
        if (status === 404) {
          setNotFound(true)
        } else {
          setError(true)
        }
        setLoading(false)
      })
  }, [id, locale])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Skeleton height="h-8" className="w-48" />
        <Skeleton height="h-10" className="w-2/3" />
        <Skeleton height="h-32" />
        <Skeleton height="h-24" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-[color:var(--color-text-muted)]">{t('notFound')}</p>
        <Link to={`/${locale}/sudovi/suci`} className="mt-4 inline-block text-[color:var(--color-text-link)] hover:underline">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  if (error || !judge) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error">{t('error')}</Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('courts.searchTitle'), href: `/${locale}/sudovi` },
          { label: tn('judges'), href: `/${locale}/sudovi/suci` },
          { label: judge.name },
        ]}
        className="mb-6"
      />

      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-6 mb-6">
        <p className="text-sm font-medium text-[color:var(--color-text-muted)] uppercase tracking-wide mb-1">
          {t('judges.detail.role')}
        </p>
        <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">
          {judge.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DetailCard label={t('judges.detail.court', 'Sud')}>
          {judge.court ? (
            <Link to={`/${locale}/sudovi/${judge.court.id}`} className="text-[color:var(--color-text-link)] hover:underline">
              {judge.court.name}
            </Link>
          ) : '—'}
        </DetailCard>

        <DetailCard label={t('judges.detail.status', 'Status')}>
          {judge.status === 'active' ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500"/>
              {t('judges.statusActive', 'Aktivan')}
            </span>
          ) : judge.status === 'inactive' ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400"/>
              {t('judges.statusInactive', 'Neaktivan')}
            </span>
          ) : (judge.status || '—')}
        </DetailCard>

        <DetailCard label={t('judges.detail.specialization', 'Specijalizacija')}>
          {judge.specialization || '—'}
        </DetailCard>

        <DetailCard label={t('judges.detail.appointmentDate', 'Datum imenovanja')}>
          {judge.appointmentDate
            ? new Date(judge.appointmentDate).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale)
            : '—'}
        </DetailCard>

        {judge.email && (
          <DetailCard label={t('judges.detail.contact', 'Kontakt')} colSpan>
            <a href={`mailto:${judge.email}`} className="text-[color:var(--color-text-link)] hover:underline">
              {judge.email}
            </a>
          </DetailCard>
        )}
      </div>

      <div className="mt-8">
        <Link
          to={`/${locale}/sudovi/suci`}
          className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
        >
          ← {t('back')}
        </Link>
      </div>
    </div>
  )
}


function DetailCard({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={`bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 ${colSpan ? 'sm:col-span-2' : ''}`}>
      <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">{label}</h2>
      <p className="text-[color:var(--color-text)]">{children}</p>
    </div>
  )
}
