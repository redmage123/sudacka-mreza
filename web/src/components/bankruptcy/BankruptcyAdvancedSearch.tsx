import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

// SM-REDESIGN §3.7.2 — shared search bar surfaced on /stecaj and its subsections.
// In 'navigate' mode the "Search" button pushes the user to /stecaj/oglasi with
// query params. In 'inline' mode the parent owns the result list and we raise
// filter changes to it (used by BankruptcyListingsPage).

export interface BankruptcyFilters {
  q?: string
  court?: string
  assetCategory?: string
  assetType?: string
  debtor?: string
  administrator?: string
  status?: string
}

interface CourtRow { id: number | string; name: string }
interface AdminRow { id: number | string; name: string }
interface DebtorRow { id: number | string; name: string }

let _courts: CourtRow[] | null = null
let _admins: AdminRow[] | null = null
let _debtors: DebtorRow[] | null = null

async function fetchOnce(slug: string, setter: (r: Array<{ id: number | string; name: string }>) => void) {
  try {
    const r = await fetch(`/api/${slug}?limit=2000&depth=0&sort=name`)
    if (!r.ok) return
    const j = (await r.json()) as { docs?: Array<{ id: number | string; name: string }> }
    setter(j.docs ?? [])
  } catch {
    // silent — search bar still works without dropdowns populated
  }
}

export function BankruptcyAdvancedSearch({
  mode = 'navigate',
  initial,
  onChange,
}: {
  mode?: 'navigate' | 'inline'
  initial?: BankruptcyFilters
  onChange?: (f: BankruptcyFilters) => void
}) {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()

  const [q, setQ] = useState(initial?.q ?? '')
  const [court, setCourt] = useState(initial?.court ?? '')
  const [assetCategory, setAssetCategory] = useState(initial?.assetCategory ?? '')
  const [assetType, setAssetType] = useState(initial?.assetType ?? '')
  const [debtor, setDebtor] = useState(initial?.debtor ?? '')
  const [administrator, setAdministrator] = useState(initial?.administrator ?? '')
  const [status, setStatus] = useState(initial?.status ?? '')

  const [courts, setCourts] = useState<CourtRow[]>(_courts ?? [])
  const [admins, setAdmins] = useState<AdminRow[]>(_admins ?? [])
  const [debtors, setDebtors] = useState<DebtorRow[]>(_debtors ?? [])

  useEffect(() => {
    if (!_courts) fetchOnce('courts', (r) => { _courts = r as CourtRow[]; setCourts(_courts) })
    if (!_admins) fetchOnce('bankruptcy-administrators', (r) => { _admins = r as AdminRow[]; setAdmins(_admins) })
    if (!_debtors) fetchOnce('bankruptcy-debtors', (r) => { _debtors = r as DebtorRow[]; setDebtors(_debtors) })
  }, [])

  useEffect(() => {
    if (mode === 'inline' && onChange) {
      onChange({ q, court, assetCategory, assetType, debtor, administrator, status })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, court, assetCategory, assetType, debtor, administrator, status, mode])

  function handleSearch() {
    if (mode === 'inline') return
    const qs = new URLSearchParams()
    if (q) qs.set('q', q)
    if (court) qs.set('court', court)
    if (assetCategory) qs.set('assetCategory', assetCategory)
    if (assetType) qs.set('assetType', assetType)
    if (debtor) qs.set('debtor', debtor)
    if (administrator) qs.set('administrator', administrator)
    if (status) qs.set('status', status)
    navigate(`/${locale}/stecaj/oglasi?${qs.toString()}`)
  }

  const sel =
    'w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]'

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="search"
          placeholder={t('bankruptcy.search.textPlaceholder', 'Pretraži u tekstu (dužnik, broj, opis)…')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.text', 'Pretraga teksta')}
        />
        <select
          value={court}
          onChange={(e) => setCourt(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.court', 'Sud')}
        >
          <option value="">{t('bankruptcy.search.allCourts', 'Svi sudovi')}</option>
          {courts.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <select
          value={assetCategory}
          onChange={(e) => setAssetCategory(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.listings.assetCategoryLabel', 'Kategorija imovine')}
        >
          <option value="">{t('bankruptcy.listings.assetCategoryAll', 'Sve kategorije imovine')}</option>
          <option value="immovable">{t('bankruptcy.listings.assetCategoryImmovable', 'Nekretnine')}</option>
          <option value="movable">{t('bankruptcy.listings.assetCategoryMovable', 'Pokretnine')}</option>
          <option value="rights">{t('bankruptcy.listings.assetCategoryRights', 'Prava')}</option>
          <option value="mixed">{t('bankruptcy.listings.assetCategoryMixed', 'Mješovito')}</option>
        </select>
        <input
          type="text"
          placeholder={t('bankruptcy.listings.assetTypePlaceholder', 'Vrsta imovine (stan, vozilo…)')}
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.assetType', 'Vrsta imovine')}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={debtor}
          onChange={(e) => setDebtor(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.debtor', 'Stečajni dužnik')}
        >
          <option value="">{t('bankruptcy.search.allDebtors', 'Svi stečajni dužnici')}</option>
          {debtors.map((d) => (
            <option key={String(d.id)} value={String(d.id)}>{d.name}</option>
          ))}
        </select>
        <select
          value={administrator}
          onChange={(e) => setAdministrator(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.administrator', 'Stečajni upravitelj')}
        >
          <option value="">{t('bankruptcy.search.allAdministrators', 'Svi stečajni upravitelji')}</option>
          {admins.map((a) => (
            <option key={String(a.id)} value={String(a.id)}>{a.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={sel}
          aria-label={t('bankruptcy.search.status', 'Status')}
        >
          <option value="">{t('bankruptcy.search.allStatuses', 'Svi statusi')}</option>
          <option value="active">{t('bankruptcy.search.statusActive', 'Aktivan')}</option>
          <option value="completed">{t('bankruptcy.search.statusCompleted', 'Dovršen')}</option>
          <option value="withdrawn">{t('bankruptcy.search.statusWithdrawn', 'Povučen')}</option>
        </select>
        {mode === 'navigate' && (
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {t('bankruptcy.search.submit', 'Pretraži')}
          </button>
        )}
      </div>
    </div>
  )
}
