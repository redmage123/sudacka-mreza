import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { apiFetch } from '@/api/client'

const StateAttorneySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  slug: z.string().optional(),
})
type StateAttorney = z.infer<typeof StateAttorneySchema>

export default function StateAttorneyDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('stateAttorneys')

  const [sa, setSA] = useState<StateAttorney | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    setNotFound(false)
    apiFetch(`/state-attorneys/${id}`, StateAttorneySchema, { params: { locale } })
      .then((d) => {
        if (!mounted.current) return
        setSA(d)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!mounted.current) return
        const status = (err as { status?: number }).status
        if (status === 404) setNotFound(true)
        else setError(true)
        setLoading(false)
      })
  }, [id, locale])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Skeleton height="h-8" className="w-48" />
        <Skeleton height="h-10" className="w-2/3" />
        <Skeleton height="h-32" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-[color:var(--color-text-muted)]">{t('notFound', 'Nije pronađeno')}</p>
        <Link to={`/${locale}/sudovi/dorh`} className="mt-4 inline-block text-[color:var(--color-text-link)] hover:underline">
          ← {t('back', 'Natrag')}
        </Link>
      </div>
    )
  }

  if (error || !sa) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error">{t('error', 'Greška')}</Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('courts'), href: `/${locale}/sudovi` },
          { label: tn('stateAttorneys'), href: `/${locale}/sudovi/dorh` },
          { label: sa.name },
        ]}
        className="mb-6"
      />

      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">{sa.name}</h1>
        {(sa.address || sa.city || sa.county) && (
          <p className="text-[color:var(--color-text-muted)] mt-2">
            {[sa.address, sa.city, sa.county].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {sa.phone && (
          <Card label={t('admin.collections.stateAttorneys.phone', 'Telefon')}>
            <a href={`tel:${sa.phone}`} className="text-[color:var(--color-text-link)] hover:underline">
              {sa.phone}
            </a>
          </Card>
        )}
        {sa.fax && (
          <Card label={t('admin.collections.stateAttorneys.fax', 'Faks')}>{sa.fax}</Card>
        )}
        {sa.email && (
          <Card label={t('admin.collections.stateAttorneys.email', 'Email')} colSpan>
            <a href={`mailto:${sa.email}`} className="text-[color:var(--color-text-link)] hover:underline">
              {sa.email}
            </a>
          </Card>
        )}
      </div>

      <div className="mt-8">
        <Link
          to={`/${locale}/sudovi/dorh`}
          className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
        >
          ← {tn('stateAttorneys')}
        </Link>
      </div>
    </div>
  )
}

function Card({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={`bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5 ${colSpan ? 'sm:col-span-2' : ''}`}>
      <h2 className="text-sm font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wide mb-3">{label}</h2>
      <p className="text-[color:var(--color-text)]">{children}</p>
    </div>
  )
}
