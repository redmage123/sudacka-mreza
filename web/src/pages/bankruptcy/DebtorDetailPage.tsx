import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const DebtorSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullable().optional(),
  oib: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})
type Debtor = z.infer<typeof DebtorSchema>

const ListingSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  caseNumber: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
})
const ListingsSchema = z.object({
  docs: z.array(ListingSchema),
  totalDocs: z.number(),
})

export default function DebtorDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyDebtors')

  const [debtor, setDebtor] = useState<Debtor | null>(null)
  const [listings, setListings] = useState<{ docs: z.infer<typeof ListingSchema>[]; totalDocs: number }>({ docs: [], totalDocs: 0 })
  const [loading, setLoading] = useState(true)
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
    Promise.all([
      apiFetch(`/bankruptcy-debtors/${id}`, DebtorSchema, { params: { locale } }),
      apiFetch('/bankruptcy-listings', ListingsSchema, {
        params: { limit: 100, sort: '-publishedAt', locale, 'where[debtor][equals]': id },
      }),
    ])
      .then(([d, l]) => {
        if (!mounted.current) return
        setDebtor(d)
        setListings(l)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [id, locale])

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('bankruptcyDebtors', 'Stečajni dužnici'), href: `/${locale}/stecaj/duznici` },
          { label: debtor?.name ?? '…' },
        ]}
      />

      {loading && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}

      {!loading && error && (
        <Alert variant="error" className="mt-6">
          {t('debtors.loadError', 'Greška pri učitavanju dužnika.')}
        </Alert>
      )}

      {!loading && !error && debtor && (
        <>
          <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
            {debtor.name ?? '—'}
          </h1>

          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {debtor.oib && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">OIB:</dt>
                <dd className="font-mono text-[color:var(--color-text-muted)]">{debtor.oib}</dd>
              </div>
            )}
            {debtor.address && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">{t('debtors.fields.address', 'Adresa')}:</dt>
                <dd className="text-[color:var(--color-text-muted)]">{debtor.address}</dd>
              </div>
            )}
            {debtor.city && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">{t('debtors.fields.city', 'Grad')}:</dt>
                <dd className="text-[color:var(--color-text-muted)]">{debtor.city}</dd>
              </div>
            )}
            {debtor.county && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">{t('debtors.fields.county', 'Županija')}:</dt>
                <dd className="text-[color:var(--color-text-muted)]">{debtor.county}</dd>
              </div>
            )}
            {debtor.email && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">Email:</dt>
                <dd className="text-[color:var(--color-text-muted)]">{debtor.email}</dd>
              </div>
            )}
            {debtor.phone && (
              <div className="flex gap-2">
                <dt className="font-medium text-[color:var(--color-text)]">{t('debtors.fields.phone', 'Telefon')}:</dt>
                <dd className="text-[color:var(--color-text-muted)]">{debtor.phone}</dd>
              </div>
            )}
          </dl>

          {debtor.notes && (
            <p className="mt-4 text-sm text-[color:var(--color-text-muted)] whitespace-pre-line">{debtor.notes}</p>
          )}

          <h2 className="mt-8 mb-3 text-xl font-semibold text-[color:var(--color-heading)]">
            {t('debtors.linkedListings', 'Stečajni postupci')} ({listings.totalDocs})
          </h2>

          {listings.docs.length === 0 ? (
            <p className="text-[color:var(--color-text-muted)]">
              {t('debtors.noLinkedListings', 'Nema povezanih stečajnih postupaka.')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--color-surface-alt)] text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                      {t('debtors.fields.caseNumber', 'Broj predmeta')}
                    </th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                      {t('debtors.fields.status', 'Status')}
                    </th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                      {t('debtors.fields.deadline', 'Rok')}
                    </th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                      {t('debtors.fields.publishedAt', 'Objavljeno')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {listings.docs.map((l) => (
                    <tr key={l.id} className="hover:bg-[color:var(--color-surface-alt)] transition-colors">
                      <td className="px-4 py-3 font-mono text-[color:var(--color-text)]">
                        <Link
                          to={`/${locale}/stecaj/oglasi/${l.id}`}
                          className="text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)]"
                        >
                          {l.caseNumber ?? l.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{l.status ?? '—'}</td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{l.deadline ? new Date(l.deadline).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale) : '—'}</td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{l.publishedAt ? new Date(l.publishedAt).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
