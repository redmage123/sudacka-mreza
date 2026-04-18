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
