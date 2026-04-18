import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const AdministratorSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullable().optional(),
  licenceNumber: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  assignedCases: z.array(z.any()).optional(),
  slug: z.string().nullable().optional(),
})
type Administrator = z.infer<typeof AdministratorSchema>

const ListSchema = z.object({
  docs: z.array(AdministratorSchema),
  totalDocs: z.number(),
})

export default function AdministratorsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('administrators')

  const [items, setItems] = useState<Administrator[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('/bankruptcy-administrators', ListSchema, {
      params: { limit: 25, locale, ...(query ? { 'where[name][like]': query } : {}) },
    })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setTotal(d.totalDocs)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [query, locale])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('administrators') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('administrators.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">{t('administrators.subtitle')}</p>

      <div className="mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('administrators.searchPlaceholder')}
          disabled={total === 0 && !loading}
          className="w-full max-w-md rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-50"
        />
      </div>

      {error && <Alert variant="error">{t('administrators.loadError')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-16 text-center">
          <p className="text-[color:var(--color-text-muted)] text-lg">{t('administrators.noResults')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-surface-alt)] text-left">
              <tr>
                {(['name', 'licenseNo', 'contact', 'city'] as const).map((f) => (
                  <th key={f} className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                    {t(`administrators.fields.${f}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-[color:var(--color-surface-alt)] transition-colors">
                  <td className="px-4 py-3 text-[color:var(--color-text)]">{a.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{a.licenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {a.email ?? a.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {a.city ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
