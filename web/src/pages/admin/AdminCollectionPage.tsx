import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '@/i18n/index'
import { getAuthToken } from '@/api/client'

// Field type descriptors for the generic editor.
// Keep tiny: text, textarea, number, checkbox, select.
// Anything richer (relationships, arrays, rich text) should get a dedicated page.
export interface FieldDef {
  name: string
  label?: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'lines'
  required?: boolean
  options?: Array<{ label: string; value: string }>
  itemKey?: string
  placeholder?: string
}

export interface CollectionAdminConfig {
  slug: string
  title: string
  /**
   * Columns to show in the list table (must be field names present in the API response).
   * First column is used as the row title. If missing from the record, id is used.
   */
  columns: string[]
  /** Editable fields. */
  fields: FieldDef[]
  /** Optional: defaults applied on create. */
  defaults?: Record<string, unknown>
  /** Optional: server-side where filter for the list view. */
  where?: string
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

function blankRecord(fields: FieldDef[], defaults?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(defaults ?? {}) }
  for (const f of fields) {
    if (!(f.name in out)) {
      out[f.name] =
        f.type === 'checkbox' ? false :
        f.type === 'number'   ? '' :
        ''
    }
  }
  return out
}

function renderCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') {
    const rel = value as { name?: string; title?: string; email?: string; id?: string | number }
    return rel.name ?? rel.title ?? rel.email ?? String(rel.id ?? '{…}')
  }
  if (typeof value === 'string' && value.length > 60) return value.slice(0, 60) + '…'
  return String(value)
}


// REDESIGN: labels in collectionConfigs are i18n keys when they contain a
// dot; otherwise they are rendered as-is. Falls back to the field name.
function labelOf(f: FieldDef, t: ReturnType<typeof useTranslation>['t']): string {
  if (!f.label) return f.name
  if (f.label.includes('.')) return t(f.label, f.name)
  return f.label
}

export function AdminCollectionPage({ config }: { config: CollectionAdminConfig }) {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const editingRef = useRef<HTMLDivElement | null>(null)

  // Scroll the edit form into view when a row is selected so the user
  // doesn't miss it appearing above a long table.
  useEffect(() => {
    if (editing && editingRef.current) {
      editingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editing])
  const [submitting, setSubmitting] = useState(false)

  const blank = useMemo(() => blankRecord(config.fields, config.defaults), [config])

  async function load() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      limit: '25',
      page: String(page),
      locale,
      sort: '-updatedAt',
    })
    if (config.where) {
      for (const p of config.where.split('&')) {
        const [k, v] = p.split('=')
        if (k && v) qs.set(k, decodeURIComponent(v))
      }
    }
    // Try `where[<firstCol>][like]=q` for the free-text box when available.
    if (q && config.columns[0]) qs.set(`where[${config.columns[0]}][like]`, q)
    try {
      const resp = await authFetch(`/api/${config.slug}?${qs.toString()}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setRows(data.docs ?? [])
      setTotal(data.totalDocs ?? 0)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, q, config.slug])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSubmitting(true)
    setError(null)
    try {
      const isCreate = !('id' in editing) || editing.id == null || editing.id === ''
      const url = isCreate ? `/api/${config.slug}` : `/api/${config.slug}/${editing.id}`
      const method = isCreate ? 'POST' : 'PATCH'
      // Strip id from body for create, and drop empty-string relationships
      const body: Record<string, unknown> = {}
      for (const f of config.fields) {
        const v = editing[f.name]
        if (f.type === 'number' && v === '') continue
        if (f.type === 'lines' && Array.isArray(v)) {
          const key = f.itemKey ?? 'value'
          body[f.name] = v.filter((x) => x != null && x !== '').map((x) => ({ [key]: x }))
        } else {
          body[f.name] = v
        }
      }
      const resp = await authFetch(url, { method, body: JSON.stringify(body) })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setFlash(isCreate ? 'Created.' : 'Updated.')
      setEditing(null)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: unknown) {
    if (!window.confirm('Delete this record?')) return
    try {
      const resp = await authFetch(`/api/${config.slug}/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setFlash('Deleted.')
      await load()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[color:var(--color-heading)]">
          {config.title} ({total.toLocaleString()})
        </h2>
        <button
          onClick={() => setEditing(blank)}
          className="rounded bg-[color:var(--color-brand)] px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          + New
        </button>
      </div>

      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}
      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div ref={editingRef} />
      {editing ? (
        <form onSubmit={save} className="space-y-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4 mb-6">
          <h3 className="font-semibold">{editing.id ? `Edit #${String(editing.id)}` : 'Create new'}</h3>
          {config.fields.map((f) => {
            const value = editing[f.name]
            const onChange = (v: unknown) => setEditing({ ...editing, [f.name]: v })
            const common = 'w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm'
            return (
              <div key={f.name}>
                <label className="block text-sm font-medium mb-1">
                  {labelOf(f, t)}
                  {f.required && <span className="text-red-600"> *</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea rows={5} required={f.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={common} />
                ) : f.type === 'number' ? (
                  <input type="number" required={f.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={common} />
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
                ) : f.type === 'select' ? (
                  <select required={f.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={common}>
                    <option value="">—</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'lines' ? (
                  <textarea
                    rows={4}
                    required={f.required}
                    value={Array.isArray(value)
                      ? value.map((it) => typeof it === 'string' ? it : (it?.[f.itemKey ?? 'value'] ?? '')).join('\n')
                      : String(value ?? '')}
                    onChange={(e) => onChange(
                      e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)
                    )}
                    placeholder={f.placeholder ?? 'One value per line'}
                    className={common}
                  />
                ) : (
                  <input type="text" required={f.required} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={common} />
                )}
              </div>
            )
          })}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)] px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-3">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder={t('admin.table.searchPlaceholder', 'Filter by {{col}}…', { col: config.columns[0] })}
          className="w-64 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-[color:var(--color-border)]">
                {config.columns.map((c) => {
                  const field = config.fields.find((f) => f.name === c)
                  const headerLabel = field ? labelOf(field, t) : c.charAt(0).toUpperCase() + c.slice(1)
                  return <th key={c} className="py-2 pr-3">{headerLabel}</th>
                })}
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {rows.map((r) => (
                <tr
                  key={String(r.id)}
                  className="cursor-pointer hover:bg-[color:var(--color-surface-alt)] transition-colors"
                  onClick={() => setEditing(r)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setEditing(r)
                    }
                  }}
                >
                  {config.columns.map((c) => (
                    <td key={c} className="py-2 pr-3">{renderCell(r[c])}</td>
                  ))}
                  <td className="py-2 pr-3 space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(r) }} className="rounded bg-[color:var(--color-brand)] px-2 py-1 text-xs text-white hover:opacity-90">{t('admin.table.edit', 'Edit')}</button>
                    <button onClick={(e) => { e.stopPropagation(); remove(r.id) }} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">{t('admin.table.delete', 'Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {total > 25 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-[color:var(--color-text-muted)]">
                {t('admin.table.range', 'Showing {{from}}–{{to}} of {{total}}', {
                  from: (page - 1) * 25 + 1,
                  to: Math.min(page * 25, total),
                  total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-[color:var(--color-border)] px-3 py-1 disabled:opacity-40"
                >
                  ‹ {t('admin.table.prev', 'Previous')}
                </button>
                <span className="px-2">
                  {t('admin.table.pageOf', 'Page {{page}} of {{total}}', {
                    page,
                    total: Math.max(1, Math.ceil(total / 25)),
                  })}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / 25)}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-[color:var(--color-border)] px-3 py-1 disabled:opacity-40"
                >
                  {t('admin.table.next', 'Next')} ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-[color:var(--color-text-muted)]">{t('admin.table.empty', 'No records.')}</p>
      )}
    </div>
  )
}

// ── Per-collection configs ───────────────────────────────────────────────────
export const collectionConfigs: Record<string, CollectionAdminConfig> = {
  courts: {
    slug: 'courts',
    title: 'Courts',
    columns: ['name', 'type', 'city', 'email'],
    fields: [
      { name: 'name', label: 'admin.collections.courts.name', type: 'text', required: true },
      { name: 'type', type: 'select', required: true, options: [
        { label: 'admin.collections.courts.type', value: 'supreme' },
        { label: 'County', value: 'county' },
        { label: 'Municipal', value: 'municipal' },
        { label: 'Commercial', value: 'commercial' },
        { label: 'High commercial', value: 'high_commercial' },
        { label: 'Administrative', value: 'administrative' },
        { label: 'Misdemeanour', value: 'misdemeanour' },
        { label: 'ECHR', value: 'echr' },
      ]},
      { name: 'address', label: 'admin.collections.courts.address', type: 'text' },
      { name: 'city', label: 'admin.collections.courts.city', type: 'text', required: true },
      { name: 'county', label: 'admin.collections.courts.county', type: 'text' },
      { name: 'phone', label: 'admin.collections.courts.phone', type: 'text' },
      { name: 'email', label: 'admin.collections.courts.email', type: 'text' },
      { name: 'website', label: 'admin.collections.courts.website', type: 'text' },
      { name: 'president', label: 'admin.collections.courts.president', type: 'text' },
      { name: 'fax',   type: 'text', label: 'admin.collections.courts.fax' },
      { name: 'notes', type: 'textarea', label: 'admin.collections.courts.notes' },
    ],
  },
  judges: {
    slug: 'judges',
    title: 'Judges',
    columns: ['name', 'specialization', 'status'],
    fields: [
      { name: 'name', label: 'admin.collections.judges.name', type: 'text', required: true },
      { name: 'specialization', label: 'admin.collections.judges.specialization', type: 'text' },
      { name: 'appointmentDate', type: 'text', label: 'admin.collections.judges.appointmentDate' },
      { name: 'email', label: 'admin.collections.judges.email', type: 'text' },
      { name: 'status', type: 'select', options: [
        { label: 'admin.collections.judges.status', value: 'active' },
        { label: 'Retired', value: 'retired' },
        { label: 'Other', value: 'other' },
      ]},
      { name: 'firstName',          type: 'text',     label: 'admin.collections.judges.firstName' },
      { name: 'lastName',           type: 'text',     label: 'admin.collections.judges.lastName' },
      { name: 'court',              type: 'number',   label: 'admin.collections.judges.court' },
      { name: 'department',         type: 'text',     label: 'admin.collections.judges.department' },
      { name: 'yearsOfExperience',  type: 'number',   label: 'admin.collections.judges.yearsOfExperience' },
      { name: 'lang', type: 'select',
        label: 'admin.collections.judges.lang',
        options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
    ],
  },
  'expert-witnesses': {
    slug: 'expert-witnesses',
    title: 'Expert witnesses',
    columns: ['name', 'city', 'county', 'email', 'verified'],
    fields: [
      { name: 'name',            type: 'text',     required: true, label: 'admin.collections.expertWitnesses.name' },
      { name: 'specialityAreas', type: 'lines',    label: 'admin.collections.expertWitnesses.specialityAreas', itemKey: 'area' },
      { name: 'languages',       type: 'lines',    label: 'admin.collections.expertWitnesses.languages', itemKey: 'language' },
      { name: 'address',         type: 'text',     label: 'admin.collections.expertWitnesses.address' },
      { name: 'county',          type: 'text',     label: 'admin.collections.expertWitnesses.county' },
      { name: 'city',            type: 'text',     label: 'admin.collections.expertWitnesses.city' },
      { name: 'company',         type: 'text',     label: 'admin.collections.expertWitnesses.company' },
      { name: 'phone',           type: 'text',     label: 'admin.collections.expertWitnesses.phone' },
      { name: 'email',           type: 'text',     label: 'admin.collections.expertWitnesses.email' },
      { name: 'verified',        type: 'checkbox', label: 'admin.collections.expertWitnesses.verified' },
      { name: 'lang',            type: 'select',   label: 'admin.collections.expertWitnesses.lang',
                                  options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
      { name: 'notes', type: 'textarea', label: 'admin.collections.expertWitnesses.notes' },
    ],
    defaults: { lang: 'hr' },
  },
  interpreters: {
    slug: 'interpreters',
    title: 'Interpreters',
    columns: ['name', 'city', 'county', 'email', 'verified'],
    fields: [
      { name: 'name',          type: 'text',     required: true, label: 'admin.collections.interpreters.name' },
      { name: 'languagePairs', type: 'lines',    label: 'admin.collections.interpreters.languagePairs', itemKey: 'pair' },
      { name: 'address',       type: 'text',     label: 'admin.collections.interpreters.address' },
      { name: 'county',        type: 'text',     label: 'admin.collections.interpreters.county' },
      { name: 'city',          type: 'text',     label: 'admin.collections.interpreters.city' },
      { name: 'company',       type: 'text',     label: 'admin.collections.interpreters.company' },
      { name: 'phone',         type: 'text',     label: 'admin.collections.interpreters.phone' },
      { name: 'email',         type: 'text',     label: 'admin.collections.interpreters.email' },
      { name: 'verified',      type: 'checkbox', label: 'admin.collections.interpreters.verified' },
      { name: 'lang',          type: 'select',   label: 'admin.collections.interpreters.lang',
                                options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
    ],
    defaults: { lang: 'hr' },
  },
  'state-attorneys': {
    slug: 'state-attorneys',
    title: 'State attorneys (DORH)',
    columns: ['name', 'city'],
    fields: [
      { name: 'name', label: 'admin.collections.stateAttorneys.name', type: 'text', required: true },
      { name: 'city', label: 'admin.collections.stateAttorneys.city', type: 'text' },
      { name: 'address', label: 'admin.collections.stateAttorneys.address', type: 'text' },
      { name: 'phone', label: 'admin.collections.stateAttorneys.phone', type: 'text' },
      { name: 'email', label: 'admin.collections.stateAttorneys.email', type: 'text' },
      { name: 'county', type: 'text', label: 'admin.collections.stateAttorneys.county' },
      { name: 'fax',    type: 'text', label: 'admin.collections.stateAttorneys.fax' },
    ],
  },
  'bankruptcy-administrators': {
    slug: 'bankruptcy-administrators',
    title: 'Bankruptcy administrators',
    columns: ['name', 'licenceNumber', 'city'],
    fields: [
      { name: 'name', label: 'admin.collections.bankruptcyAdministrators.name', type: 'text', required: true },
      { name: 'licenceNumber', label: 'admin.collections.bankruptcyAdministrators.licenceNumber', type: 'text' },
      { name: 'phone', label: 'admin.collections.bankruptcyAdministrators.phone', type: 'text' },
      { name: 'email', label: 'admin.collections.bankruptcyAdministrators.email', type: 'text' },
      { name: 'address', label: 'admin.collections.bankruptcyAdministrators.address', type: 'text' },
      { name: 'city', label: 'admin.collections.bankruptcyAdministrators.city', type: 'text' },
      { name: 'county', label: 'admin.collections.bankruptcyAdministrators.county', type: 'text' },
      { name: 'courts', type: 'lines', itemKey: 'value', label: 'admin.collections.bankruptcyAdministrators.courts' },
    ],
  },
  'bankruptcy-debtors': {
    slug: 'bankruptcy-debtors',
    title: 'Bankruptcy debtors',
    columns: ['name', 'oib', 'city', 'county'],
    fields: [
      { name: 'name', type: 'text', required: true, label: 'admin.collections.bankruptcyDebtors.name' },
      { name: 'oib', type: 'text', label: 'admin.collections.bankruptcyDebtors.oib' },
      { name: 'address', type: 'text', label: 'admin.collections.bankruptcyDebtors.address' },
      { name: 'city', type: 'text', label: 'admin.collections.bankruptcyDebtors.city' },
      { name: 'county', type: 'text', label: 'admin.collections.bankruptcyDebtors.county' },
      { name: 'phone', type: 'text', label: 'admin.collections.bankruptcyDebtors.phone' },
      { name: 'email', type: 'text', label: 'admin.collections.bankruptcyDebtors.email' },
      { name: 'notes', type: 'textarea', label: 'admin.collections.bankruptcyDebtors.notes' },
    ],
  },
  laws: {
    slug: 'laws',
    title: 'Laws',
    columns: ['title', 'category', 'effectiveDate'],
    fields: [
      { name: 'title', label: 'admin.collections.laws.title', type: 'text', required: true },
      { name: 'category', label: 'admin.collections.laws.category', type: 'text' },
      { name: 'effectiveDate', type: 'text', label: 'admin.collections.laws.effectiveDate' },
      { name: 'officialGazette', label: 'admin.collections.laws.officialGazette', type: 'text' },
      { name: 'summary', label: 'admin.collections.laws.summary', type: 'textarea' },
      { name: 'type',        type: 'text',     label: 'admin.collections.laws.type' },
      { name: 'year',        type: 'number',   label: 'admin.collections.laws.year' },
      { name: 'fullText',    type: 'textarea', label: 'admin.collections.laws.fullText' },
      { name: 'externalUrl', type: 'text',     label: 'admin.collections.laws.externalUrl' },
      { name: 'lang', type: 'select',
        label: 'admin.collections.laws.lang',
        options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
    ],
  },
  'legal-categories': {
    slug: 'legal-categories',
    title: 'Legal categories',
    columns: ['name_hr', 'name_en', 'slug'],
    fields: [
      { name: 'name_hr', label: 'admin.collections.legalCategories.name_hr', type: 'text', required: true },
      { name: 'name_en', label: 'admin.collections.legalCategories.name_en', type: 'text' },
      { name: 'description', label: 'admin.collections.legalCategories.description', type: 'textarea' },
    ],
  },
  documents: {
    slug: 'documents',
    title: 'Documents',
    columns: ['title', 'category'],
    fields: [
      { name: 'title', label: 'admin.collections.documents.title', type: 'text', required: true },
      { name: 'description', label: 'admin.collections.documents.description', type: 'textarea' },
      { name: 'category', label: 'admin.collections.documents.category', type: 'text' },
      { name: 'publishedAt', type: 'text', label: 'admin.collections.documents.publishedAt' },
      { name: 'lang', type: 'select',
        label: 'admin.collections.documents.lang',
        options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
    ],
  },
  pages: {
    slug: 'pages',
    title: 'Pages',
    columns: ['title', 'slug'],
    fields: [
      { name: 'title', label: 'admin.collections.pages.title', type: 'text', required: true },
      { name: 'slug', label: 'admin.collections.pages.slug', type: 'text', required: true },
      { name: 'content', label: 'admin.collections.pages.content', type: 'textarea' },
      { name: 'metaTitle',       type: 'text',     label: 'admin.collections.pages.metaTitle' },
      { name: 'metaDescription', type: 'textarea', label: 'admin.collections.pages.metaDescription' },
      { name: 'lang', type: 'select',
        label: 'admin.collections.pages.lang',
        options: SUPPORTED_LANGUAGES.map((c) => ({ value: c, label: LANGUAGE_LABELS[c] ?? c })) },
    ],
  },
  'api-keys': {
    slug: 'api-keys',
    title: 'API keys',
    columns: ['label', 'key', 'active'],
    fields: [
      { name: 'label', label: 'admin.collections.apiKeys.label', type: 'text', required: true },
      { name: 'active', label: 'admin.collections.apiKeys.active', type: 'checkbox' },
      { name: 'organization', type: 'text',     label: 'admin.collections.apiKeys.organization' },
      { name: 'email',        type: 'text',     label: 'admin.collections.apiKeys.email' },
      { name: 'rateLimit',    type: 'number',   label: 'admin.collections.apiKeys.rateLimit' },
    ],
  },
}

export default function AdminCollectionRoute({ slug }: { slug: keyof typeof collectionConfigs }) {
  const config = collectionConfigs[slug]
  if (!config) return <p className="text-red-600">Unknown collection: {slug}</p>
  return <AdminCollectionPage config={config} />
}
