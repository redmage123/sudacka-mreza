import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const IdSchema = z.union([z.string(), z.number()]).transform(String)

const FilingSchema = z.object({
  id: IdSchema,
  filingType: z.string().nullable().optional(),
  caseNumber: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  submittedBy: z.string().nullable().optional(),
  attachmentFilename: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
})
type Filing = z.infer<typeof FilingSchema>

const ListSchema = z.object({
  docs: z.array(FilingSchema),
  totalDocs: z.number(),
  totalPages: z.number().optional(),
  page: z.number().optional(),
})

const PAGE_SIZE = 20

const FILING_TYPES = [
  'motion-to-open',
  'prijava-trazbine',
  'asset-inventory',
  'asset-sale',
  'trustee-report',
  'distribution-proposal',
  'final-accounting',
  'restructuring-plan',
  'pre-bankruptcy-settlement',
] as const

const TYPE_KEY: Record<string, string> = {
  'motion-to-open': 'admin.collections.bankruptcyFilings.types.motionToOpen',
  'prijava-trazbine': 'admin.collections.bankruptcyFilings.types.creditorClaim',
  'asset-inventory': 'admin.collections.bankruptcyFilings.types.assetInventory',
  'asset-sale': 'admin.collections.bankruptcyFilings.types.assetSale',
  'trustee-report': 'admin.collections.bankruptcyFilings.types.trusteeReport',
  'distribution-proposal': 'admin.collections.bankruptcyFilings.types.distributionProposal',
  'final-accounting': 'admin.collections.bankruptcyFilings.types.finalAccounting',
  'restructuring-plan': 'admin.collections.bankruptcyFilings.types.restructuringPlan',
  'pre-bankruptcy-settlement': 'admin.collections.bankruptcyFilings.types.preBankruptcySettlement',
}

export default function BankruptcyFilingsListPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyFilings')

  const [items, setItems] = useState<Filing[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [filingType, setFilingType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params: Record<string, string | number> = {
      limit: PAGE_SIZE,
      page,
      locale,
      sort: '-publishedAt',
    }
    if (q) params['where[caseNumber][like]'] = q
    if (filingType) params['where[filingType][equals]'] = filingType
    apiFetch('/bankruptcy-filings', ListSchema, { params })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setTotalDocs(d.totalDocs)
        setTotalPages(d.totalPages ?? 1)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [page, q, filingType, locale])

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: t('bankruptcy.filings.title', 'Stečajni podnesci') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('bankruptcy.filings.title', 'Stečajni podnesci')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('bankruptcy.filings.description',
          'Odobreni stečajni podnesci po vrsti i predmetu. Pristup izvornom PDF-u imaju samo administratori i podnositelj.')}
      </p>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder={t('bankruptcy.filings.searchPlaceholder', 'Broj predmeta…')}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        />
        <select
          value={filingType}
          onChange={(e) => { setFilingType(e.target.value); setPage(1) }}
          aria-label={t('admin.collections.bankruptcyFilings.filingType', 'Vrsta podneska')}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]"
        >
          <option value="">{t('bankruptcy.filings.allTypes', 'Sve vrste podneska')}</option>
          {FILING_TYPES.map((tp) => (
            <option key={tp} value={tp}>{t(TYPE_KEY[tp], tp)}</option>
          ))}
        </select>
        <span className="self-center text-sm text-[color:var(--color-text-muted)]">
          {t('bankruptcy.filings.count', '{{n}} podnesaka', { n: totalDocs })}
        </span>
      </div>

      {error && <Alert variant="error">{t('bankruptcy.filings.loadError', 'Nije moguće učitati podneske.')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg font-medium text-[color:var(--color-text-muted)]">
            {t('bankruptcy.filings.empty', 'Nema odobrenih podnesaka.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((f) => {
            const typeLabel = f.filingType ? t(TYPE_KEY[f.filingType] ?? f.filingType, f.filingType) : '—'
            const stamp = f.publishedAt || f.createdAt
            return (
              <Link
                key={f.id}
                to={`/${locale}/stecaj/podnesci/${f.id}`}
                className="block bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 hover:border-[color:var(--color-brand-gold)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-[color:var(--color-heading)]">{typeLabel}</h2>
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      {f.caseNumber ?? t('bankruptcy.filings.noCase', '(bez broja predmeta)')}
                      {stamp && ` · ${new Date(stamp).toLocaleDateString()}`}
                    </p>
                  </div>
                  {f.attachmentFilename && (
                    <span className="shrink-0 rounded bg-[color:var(--color-surface-alt)] px-2 py-1 text-xs text-[color:var(--color-text-muted)]">
                      📎 {f.attachmentFilename}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination className="mt-6" page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  )
}
