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
  slug: z.string().nullable().optional(),
})
type Debtor = z.infer<typeof DebtorSchema>

const ListSchema = z.object({
  docs: z.array(DebtorSchema),
  totalDocs: z.number(),
})

export default function DebtorsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyDebtors')

  const [items, setItems] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [oibQuery, setOibQuery] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params: Record<string, string | number> = { limit: 25, locale, sort: 'name' }
    if (query) {
      params['where[or][0][name][like]'] = query
      params['where[or][1][city][like]'] = query
    }
    if (oibQuery) params['where[oib][like]'] = oibQuery
    apiFetch('/bankruptcy-debtors', ListSchema, { params })
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
  }, [query, oibQuery, locale])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('bankruptcyDebtors', 'Stečajni dužnici') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('debtors.title', 'Stečajni dužnici')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('debtors.subtitle', 'Direktorij dužnika nad kojima se vodi ili se vodio stečajni postupak.')}
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('debtors.searchPlaceholder', 'Pretraga po nazivu ili gradu…')}
          className="flex-1 min-w-[240px] max-w-md rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
        <input
          type="search"
          inputMode="numeric"
          maxLength={11}
          value={oibQuery}
          onChange={(e) => setOibQuery(e.target.value)}
          placeholder={t('debtors.oibPh', 'OIB…')}
          className="min-w-[160px] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
      </div>

      {error && <Alert variant="error">{t('debtors.loadError', 'Greška pri učitavanju dužnika.')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-16 text-center">
          <p className="text-[color:var(--color-text-muted)] text-lg">
            {t('debtors.noResults', 'Nema dužnika koji odgovaraju pretrazi.')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--color-surface-alt)] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                  {t('debtors.fields.name', 'Naziv / Ime')}
                </th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">OIB</th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                  {t('debtors.fields.city', 'Grad')}
                </th>
                <th className="px-4 py-3 font-semibold text-[color:var(--color-heading)]">
                  {t('debtors.fields.county', 'Županija')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-[color:var(--color-surface-alt)] transition-colors">
                  <td className="px-4 py-3 text-[color:var(--color-text)]">
                    <Link
                      to={`/${locale}/stecaj/duznici/${d.id}`}
                      className="text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)]"
                    >
                      {d.name ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[color:var(--color-text-muted)]">{d.oib ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{d.city ?? '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{d.county ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
