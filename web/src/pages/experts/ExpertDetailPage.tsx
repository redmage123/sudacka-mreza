import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Skeleton } from '@/components/ui/Skeleton'
import { getExpertWitnessById } from '@/api/expert-witnesses'
import type { ExpertWitness } from '@/api/types'

export default function ExpertDetailPage() {
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [expert, setExpert] = useState<ExpertWitness | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    setNotFound(false)
    getExpertWitnessById(id, locale)
      .then((data) => {
        setExpert(data)
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
        <Link to={`/${locale}/strucnjaci/vjestaci`} className="mt-4 inline-block text-[color:var(--color-text-link)] hover:underline">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  if (error || !expert) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error">{t('error')}</Alert>
      </div>
    )
  }

  const raw = expert as unknown as Record<string, unknown>
  const assignedCourts = Array.isArray(raw.assignedCourts)
    ? (raw.assignedCourts as Array<{ id: string | number; name: string; slug?: string }>)
    : []

  interface WeekdayHoursRow {
    weekday?: string
    closed?: boolean
    openTime?: string
    closeTime?: string
    secondOpenTime?: string
    secondCloseTime?: string
    note?: string
  }
  const workingHours = Array.isArray(raw.workingHours) ? (raw.workingHours as WeekdayHoursRow[]) : []
  const expertType = typeof raw.expertType === 'string' ? raw.expertType : ''
  const educationLevel = typeof raw.educationLevel === 'string' ? raw.educationLevel : ''
  const cv = raw.cv as { id?: number | string; filename?: string; url?: string } | null | undefined

  const EXPERT_TYPE_LABEL: Record<string, string> = {
    vjestak: 'Stalni sudski vještak',
    procjenitelj: 'Stalni sudski procjenitelj',
    tumac: 'Stalni sudski tumač',
  }
  const EDUCATION_LABEL: Record<string, string> = {
    sss: 'SSS',
    'vss-vs': 'VŠS',
    vss: 'VSS',
    mr: 'mr.sc.',
    dr: 'dr.sc.',
  }
  const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const WEEKDAY_KEY: Record<string, string> = {
    mon: 'admin.weekday.mon', tue: 'admin.weekday.tue', wed: 'admin.weekday.wed',
    thu: 'admin.weekday.thu', fri: 'admin.weekday.fri', sat: 'admin.weekday.sat',
    sun: 'admin.weekday.sun',
  }
  const orderedHours = WEEKDAY_ORDER
    .map((d) => workingHours.find((h) => h.weekday === d))
    .filter((h): h is WeekdayHoursRow => !!h)
  const cvHref = cv?.url || (cv?.filename ? `/api/media/file/${encodeURIComponent(cv.filename)}` : null)

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('experts.searchTitle'), href: `/${locale}/strucnjaci/vjestaci` },
          { label: expert.name },
        ]}
        className="mb-6"
      />

      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[color:var(--color-text-muted)] uppercase tracking-wide mb-1">
              {t('experts.detail.role')}
            </p>
            <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">
              {expert.name}
            </h1>
          </div>
          {expert.verified && (
            <Badge variant="verified">{t('verified')}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {expert.speciality_areas && expert.speciality_areas.length > 0 && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.specialities')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {expert.speciality_areas.map((area) => (
                <Badge key={area} variant="info">{area}</Badge>
              ))}
            </div>
          </div>
        )}

        {expert.languages && expert.languages.length > 0 && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.spokenLanguages')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {expert.languages.map((lang) => (
                <Badge key={lang} variant="info">{lang}</Badge>
              ))}
            </div>
          </div>
        )}

        {typeof raw.county === 'string' && raw.county && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.county')}
            </h2>
            <p className="text-[color:var(--color-text)]">{raw.county}</p>
          </div>
        )}

        {assignedCourts.length > 0 && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.assignedCourts')}
            </h2>
            <ul className="space-y-1 text-sm text-[color:var(--color-text)]">
              {assignedCourts.map((court) => (
                <li key={court.id}>
                  {court.slug ? (
                    <Link
                      to={`/${locale}/sudovi/${court.slug}`}
                      className="text-[color:var(--color-text-link)] hover:underline"
                    >
                      {court.name}
                    </Link>
                  ) : (
                    court.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(expertType || educationLevel) && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.qualifications', 'Kvalifikacije')}
            </h2>
            <dl className="text-sm space-y-2">
              {expertType && (
                <div>
                  <dt className="inline text-[color:var(--color-text-muted)]">{t('experts.detail.expertType', 'Vrsta vještaka')}: </dt>
                  <dd className="inline">{EXPERT_TYPE_LABEL[expertType] ?? expertType}</dd>
                </div>
              )}
              {educationLevel && (
                <div>
                  <dt className="inline text-[color:var(--color-text-muted)]">{t('experts.detail.educationLevel', 'Razina obrazovanja')}: </dt>
                  <dd className="inline">{EDUCATION_LABEL[educationLevel] ?? educationLevel}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {orderedHours.length > 0 && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 sm:col-span-2">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.workingHours', 'Radno vrijeme')}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {orderedHours.map((h) => (
                  <tr key={h.weekday} className="border-t border-[color:var(--color-border)] first:border-t-0">
                    <th className="py-1 pr-3 text-left font-medium w-1/3">
                      {t(WEEKDAY_KEY[h.weekday ?? ''] ?? '', h.weekday ?? '')}
                    </th>
                    <td className="py-1">
                      {h.closed
                        ? <em className="text-[color:var(--color-text-muted)]">{t('courts.closed', 'Zatvoreno')}</em>
                        : (h.openTime && h.closeTime
                            ? `${h.openTime}–${h.closeTime}${h.secondOpenTime && h.secondCloseTime ? `, ${h.secondOpenTime}–${h.secondCloseTime}` : ''}`
                            : '')}
                      {h.note && <span className="ml-2 text-xs text-[color:var(--color-text-muted)]">({h.note})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cv && cvHref && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.cv', 'Životopis (CV)')}
            </h2>
            <a
              href={cvHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              📄 {cv.filename ?? t('experts.detail.openCv', 'Otvori CV')}
            </a>
          </div>
        )}

        {(expert.email || expert.phone) && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 sm:col-span-2">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('experts.detail.contactDetails')}
            </h2>
            <div className="space-y-1 text-sm text-[color:var(--color-text)]">
              {expert.email && (
                <p>
                  <a href={`mailto:${expert.email}`} className="text-[color:var(--color-text-link)] hover:underline">
                    {expert.email}
                  </a>
                </p>
              )}
              {expert.phone && <p>{expert.phone}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link
          to={`/${locale}/strucnjaci/vjestaci`}
          className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
        >
          ← {t('back')}
        </Link>
      </div>
    </div>
  )
}
