import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { apiFetch } from '@/api/client'

const CourtRefSchema = z.union([
  z.string(),
  z.number(),
  z.object({ id: z.union([z.string(), z.number()]), name: z.string().optional() }),
]).transform((v) => {
  if (typeof v === 'object') return { id: String(v.id), name: v.name }
  return { id: String(v), name: undefined as string | undefined }
})

const AdministratorSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullable().optional(),
  licenceNumber: z.string().nullable().optional(),
  oib: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  courts: z.array(CourtRefSchema).optional(),
  slug: z.string().nullable().optional(),
})
type Administrator = z.infer<typeof AdministratorSchema>

const FilingSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  caseNumber: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
})
const FilingListSchema = z.object({ docs: z.array(FilingSchema), totalDocs: z.number() })

export default function AdministratorDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('administrators')

  const [admin, setAdmin] = useState<Administrator | null>(null)
  const [filings, setFilings] = useState<{ docs: z.infer<typeof FilingSchema>[]; totalDocs: number }>({ docs: [], totalDocs: 0 })
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
    Promise.all([
      apiFetch(`/bankruptcy-administrators/${id}`, AdministratorSchema, { params: { locale, depth: 1 } }),
      apiFetch('/bankruptcy-listings', FilingListSchema, {
        params: { limit: 50, sort: '-publishedAt', locale, 'where[administrator][equals]': id },
      }).catch(() => ({ docs: [], totalDocs: 0 })),
    ])
      .then(([a, f]) => {
        if (!mounted.current) return
        setAdmin(a)
        setFilings(f)
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
        <Link to={`/${locale}/stecaj/upravitelji`} className="mt-4 inline-block text-[color:var(--color-text-link)] hover:underline">
          ← {t('back', 'Natrag')}
        </Link>
      </div>
    )
  }

  if (error || !admin) {
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
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('administrators'), href: `/${locale}/stecaj/upravitelji` },
          { label: admin.name ?? '—' },
        ]}
        className="mb-6"
      />

      <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">{admin.name ?? '—'}</h1>
        {admin.licenceNumber && (
          <p className="text-[color:var(--color-text-muted)] mt-2">
            <span className="font-medium">{t('admin.collections.bankruptcyAdministrators.licenceNumber', 'Broj licence')}:</span>{' '}
            {admin.licenceNumber}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {admin.address && <Card label={t('admin.collections.bankruptcyAdministrators.address', 'Adresa')}>{admin.address}</Card>}
        {admin.city && <Card label={t('admin.collections.bankruptcyAdministrators.city', 'Grad')}>{admin.city}</Card>}
        {admin.county && <Card label={t('admin.collections.bankruptcyAdministrators.county', 'Županija')}>{admin.county}</Card>}
        {admin.phone && (
          <Card label={t('admin.collections.bankruptcyAdministrators.phone', 'Telefon')}>
            <a href={`tel:${admin.phone}`} className="text-[color:var(--color-text-link)] hover:underline">{admin.phone}</a>
          </Card>
        )}
        {admin.email && (
          <Card label={t('admin.collections.bankruptcyAdministrators.email', 'Email')} colSpan>
            <a href={`mailto:${admin.email}`} className="text-[color:var(--color-text-link)] hover:underline">{admin.email}</a>
          </Card>
        )}
        {admin.courts && admin.courts.length > 0 && (
          <Card label={t('admin.collections.bankruptcyAdministrators.courts', 'Dodijeljeni sudovi')} colSpan>
            <ul className="list-disc list-inside text-sm">
              {admin.courts.map((c, i) => (
                <li key={`${c.id}-${i}`}>{c.name ?? `#${c.id}`}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {filings.totalDocs > 0 && (
        <div className="mt-8 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-3">
            {t('administrators.assignedCases', 'Dodijeljeni predmeti')} ({filings.totalDocs})
          </h2>
          <ul className="divide-y divide-[color:var(--color-border)]">
            {filings.docs.slice(0, 20).map((f) => (
              <li key={f.id} className="py-2 flex items-baseline gap-3 text-sm">
                <Link
                  to={`/${locale}/stecaj/oglasi/${f.id}`}
                  className="text-[color:var(--color-text-link)] hover:underline"
                >
                  {f.caseNumber ?? `#${f.id}`}
                </Link>
                {f.status && <span className="text-[color:var(--color-text-muted)]">— {f.status}</span>}
                {f.publishedAt && (
                  <span className="text-[color:var(--color-text-muted)] ml-auto">
                    {new Date(f.publishedAt).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Link
          to={`/${locale}/stecaj/upravitelji`}
          className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
        >
          ← {tn('administrators')}
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
