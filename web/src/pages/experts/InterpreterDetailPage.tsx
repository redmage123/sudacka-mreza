import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Skeleton } from '@/components/ui/Skeleton'
import MetaTags from '@/components/seo/MetaTags'
import { getInterpreterById } from '@/api/interpreters'
import type { Interpreter } from '@/api/types'

export default function InterpreterDetailPage() {
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [interpreter, setInterpreter] = useState<Interpreter | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    setNotFound(false)
    getInterpreterById(id, locale)
      .then((data) => {
        setInterpreter(data)
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
        <Link to={`/${locale}/strucnjaci/tumaci`} className="mt-4 inline-block text-[color:var(--color-text-link)] hover:underline">
          ← {t('back')}
        </Link>
      </div>
    )
  }

  if (error || !interpreter) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error">{t('error')}</Alert>
      </div>
    )
  }

  const raw = interpreter as unknown as Record<string, unknown>

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <MetaTags
        title={`${interpreter.name} — ${t('interpreters.detail.role')}`}
        description={`${t('interpreters.detail.role')}: ${interpreter.name}`}
        lang={locale as 'hr' | 'en'}
        canonicalPath={`/${locale}/strucnjaci/tumaci/${id}`}
      />
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('interpreters.searchTitle'), href: `/${locale}/strucnjaci/tumaci` },
          { label: interpreter.name },
        ]}
        className="mb-6"
      />

      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[color:var(--color-text-muted)] uppercase tracking-wide mb-1">
              {t('interpreters.detail.role')}
            </p>
            <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">
              {interpreter.name}
            </h1>
          </div>
          {interpreter.verified && (
            <Badge variant="verified">{t('verified')}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {interpreter.language_pairs && interpreter.language_pairs.length > 0 && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('interpreters.detail.languagePairs')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {interpreter.language_pairs.map((pair) => (
                <Badge key={pair} variant="info">{pair}</Badge>
              ))}
            </div>
          </div>
        )}

        {typeof raw.county === 'string' && raw.county && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('interpreters.detail.county')}
            </h2>
            <p className="text-[color:var(--color-text)]">{raw.county}</p>
          </div>
        )}

        {(() => {
          interface WkRow {
            weekday?: string; closed?: boolean
            openTime?: string; closeTime?: string
            secondOpenTime?: string; secondCloseTime?: string; note?: string
          }
          const wh = Array.isArray(raw.workingHours) ? (raw.workingHours as WkRow[]) : []
          const ORDER = ['mon','tue','wed','thu','fri','sat','sun']
          const KEY: Record<string,string> = {mon:'admin.weekday.mon',tue:'admin.weekday.tue',wed:'admin.weekday.wed',thu:'admin.weekday.thu',fri:'admin.weekday.fri',sat:'admin.weekday.sat',sun:'admin.weekday.sun'}
          const rows = ORDER.map((d) => wh.find((h) => h.weekday === d)).filter((h): h is WkRow => !!h)
          if (rows.length === 0) return null
          return (
            <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 sm:col-span-2">
              <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
                {t('interpreters.detail.workingHours', 'Radno vrijeme')}
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.weekday} className="border-t border-[color:var(--color-border)] first:border-t-0">
                      <th className="py-1 pr-3 text-left font-medium w-1/3">{t(KEY[h.weekday ?? ''] ?? '', h.weekday ?? '')}</th>
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
          )
        })()}

        {(() => {
          const cv = raw.cv as { id?: number | string; filename?: string; url?: string } | null | undefined
          const cvHref = cv?.url || (cv?.filename ? `/api/media/file/${encodeURIComponent(cv.filename)}` : null)
          if (!cv || !cvHref) return null
          return (
            <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
                {t('interpreters.detail.cv', 'Životopis (CV)')}
              </h2>
              <a href={cvHref} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                📄 {cv.filename ?? t('interpreters.detail.openCv', 'Otvori CV')}
              </a>
            </div>
          )
        })()}

        {(interpreter.email || interpreter.phone) && (
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 sm:col-span-2">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t('interpreters.detail.contactDetails')}
            </h2>
            <div className="space-y-1 text-sm text-[color:var(--color-text)]">
              {interpreter.email && (
                <p>
                  <a href={`mailto:${interpreter.email}`} className="text-[color:var(--color-text-link)] hover:underline">
                    {interpreter.email}
                  </a>
                </p>
              )}
              {interpreter.phone && <p>{interpreter.phone}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link
          to={`/${locale}/strucnjaci/tumaci`}
          className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
        >
          ← {t('back')}
        </Link>
      </div>
    </div>
  )
}
