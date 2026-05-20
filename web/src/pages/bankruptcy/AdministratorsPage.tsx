import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

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
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  courts: z.array(CourtRefSchema).optional(),
  assignedCases: z.array(z.any()).optional(),
  slug: z.string().nullable().optional(),
})
type Administrator = z.infer<typeof AdministratorSchema>

const ListSchema = z.object({
  docs: z.array(AdministratorSchema),
  totalDocs: z.number(),
})

const CourtOptionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
})
const CourtListSchema = z.object({ docs: z.array(CourtOptionSchema) })
type CourtOption = z.infer<typeof CourtOptionSchema>

export default function AdministratorsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('administrators')

  const [items, setItems] = useState<Administrator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [courtFilter, setCourtFilter] = useState('')
  const [courtOptions, setCourtOptions] = useState<CourtOption[]>([])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Load court options for the filter dropdown (one shot).
  useEffect(() => {
    apiFetch('/courts', CourtListSchema, {
      params: { limit: 200, sort: 'name', locale, depth: 0 },
    })
      .then((d) => { if (mounted.current) setCourtOptions(d.docs) })
      .catch(() => { /* dropdown stays empty — keyword search still works */ })
  }, [locale])

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params: Record<string, string | number> = { limit: 25, locale, depth: 1 }
    if (query) params['where[name][like]'] = query
    if (courtFilter) params['where[courts][in]'] = courtFilter
    apiFetch('/bankruptcy-administrators', ListSchema, { params })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [query, courtFilter, locale])

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

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('administrators.searchPlaceholder')}
          className="flex-1 min-w-[240px] max-w-md rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
        <select
          value={courtFilter}
          onChange={(e) => setCourtFilter(e.target.value)}
          aria-label={t('administrators.fields.court', 'Sud')}
          className="min-w-[220px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        >
          <option value="">{t('administrators.filterCourtAll', 'Svi sudovi / All courts')}</option>
          {courtOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
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
                {(['name', 'licenseNo', 'court', 'contact', 'city'] as const).map((f) => (
                  <th key={f} className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                    {t(`administrators.fields.${f}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {items.map((a) => {
                const courtsLabel = (() => {
                  const cs = a.courts ?? []
                  const names = cs.map((c) => c.name).filter((n): n is string => Boolean(n))
                  if (names.length === 0) return '—'
                  if (names.length === 1) return names[0]
                  return `${names[0]} +${names.length - 1}`
                })()
                return (
                <tr key={a.id} className="hover:bg-[color:var(--color-surface-alt)] transition-colors">
                  <td className="px-4 py-3 text-[color:var(--color-text)]">{a.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{a.licenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{courtsLabel}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {a.email ?? a.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                    {a.city ?? '—'}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
