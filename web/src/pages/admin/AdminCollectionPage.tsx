import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { getAuthToken } from '@/api/client'

// Field type descriptors for the generic editor.
// Scalars: text, textarea, number, checkbox, select.
// Composites: array (subfields per item), relationship (single FK -> picker),
// relationshipMany (hasMany FK -> add/remove list of pickers).
export interface FieldDef {
  name: string
  label?: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select'
      | 'array' | 'relationship' | 'relationshipMany'
  required?: boolean
  options?: Array<{ label: string; value: string }>
  /** For type='array' — the subfields rendered per array item. */
  fields?: FieldDef[]
  /** For type='relationship' / 'relationshipMany' — target collection slug
   *  (e.g. 'media'). The picker fetches /api/<relationTo>?limit=200&sort=...
   *  and renders a <select> populated with the resulting docs. */
  relationTo?: string
  /** Which field to display in the picker option label (default: 'name',
   *  falls back to 'filename' for media, 'title' for legal-categories etc). */
  relationLabel?: string
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
        f.type === 'checkbox'          ? false :
        f.type === 'number'            ? '' :
        f.type === 'array'             ? [] :
        f.type === 'relationshipMany'  ? [] :
        f.type === 'relationship'      ? null :
        ''
    }
  }
  return out
}

function blankArrayItem(subFields: FieldDef[]): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const sf of subFields) {
    item[sf.name] =
      sf.type === 'checkbox'         ? false :
      sf.type === 'number'           ? '' :
      sf.type === 'array'            ? [] :
      sf.type === 'relationshipMany' ? [] :
      sf.type === 'relationship'     ? null :
      ''
  }
  return item
}

/** Extract just the id from a Payload relationship value, which may be:
 *   - a number/string (depth=0)
 *   - an object { id, ... } (depth>=1)
 *   - null / undefined */
function relId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') return String((v as { id?: string | number }).id ?? '')
  return String(v)
}

/** Pick a human label from a Payload doc for the picker dropdown. */
function relLabel(doc: Record<string, unknown>, prefer?: string): string {
  if (prefer && doc[prefer] != null) return String(doc[prefer])
  for (const k of ['name', 'title', 'filename', 'email', 'slug']) {
    if (doc[k] != null) return String(doc[k])
  }
  return `#${doc.id ?? '?'}`
}

// ─── Composite-field editors ────────────────────────────────────────────────

function RelationshipManyEditor({
  selected,
  options,
  onChange,
}: {
  selected: string[]
  options: Array<{ id: string; label: string }>
  onChange: (next: string[]) => void
}) {
  const common = 'rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm flex-1'
  const setAt = (i: number, v: string) => {
    const next = [...selected]
    next[i] = v
    onChange(next.filter(Boolean))
  }
  const remove = (i: number) => onChange(selected.filter((_, idx) => idx !== i))
  const add = () => onChange([...selected, ''])
  return (
    <div className="space-y-1.5">
      {selected.map((sel, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={sel} onChange={(e) => setAt(i, e.target.value)} className={common}>
            <option value="">— pick —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 hover:underline">remove</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-[color:var(--color-brand)] hover:underline">
        + add
      </button>
    </div>
  )
}

function ArrayEditor({
  items,
  subFields,
  relOptions,
  onChange,
}: {
  items: Array<Record<string, unknown>>
  subFields: FieldDef[]
  relOptions: Record<string, Array<{ id: string; label: string }>>
  onChange: (next: Array<Record<string, unknown>>) => void
}) {
  const common = 'w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm'
  const setAt = (i: number, name: string, v: unknown) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [name]: v } : it))
    onChange(next)
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, blankArrayItem(subFields)])
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-2 space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {subFields.map((sf) => {
                const sv = item[sf.name]
                const setV = (v: unknown) => setAt(i, sf.name, v)
                return (
                  <div key={sf.name}>
                    <label className="block text-xs text-[color:var(--color-text-muted)] mb-0.5">
                      {sf.label ?? sf.name}{sf.required && <span className="text-red-600"> *</span>}
                    </label>
                    {sf.type === 'select' ? (
                      <select value={String(sv ?? '')} onChange={(e) => setV(e.target.value)} className={common}>
                        <option value="">—</option>
                        {sf.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : sf.type === 'textarea' ? (
                      <textarea rows={2} value={String(sv ?? '')} onChange={(e) => setV(e.target.value)} className={common} />
                    ) : sf.type === 'relationship' ? (
                      <select value={relId(sv)} onChange={(e) => setV(e.target.value || null)} className={common}>
                        <option value="">—</option>
                        {(relOptions[sf.relationTo ?? ''] ?? []).map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    ) : sf.type === 'number' ? (
                      <input type="number" value={String(sv ?? '')} onChange={(e) => setV(e.target.value === '' ? '' : Number(e.target.value))} className={common} />
                    ) : sf.type === 'checkbox' ? (
                      <input type="checkbox" checked={!!sv} onChange={(e) => setV(e.target.checked)} />
                    ) : (
                      <input type="text" value={String(sv ?? '')} onChange={(e) => setV(e.target.value)} className={common} />
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => remove(i)} className="mt-5 text-xs text-red-600 hover:underline whitespace-nowrap">remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-[color:var(--color-brand)] hover:underline">
        + add row
      </button>
    </div>
  )
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

export function AdminCollectionPage({ config }: { config: CollectionAdminConfig }) {
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
  const [submitting, setSubmitting] = useState(false)

  const blank = useMemo(() => blankRecord(config.fields, config.defaults), [config])

  // Relationship options keyed by target collection slug.
  // Fetched lazily the first time a form with relationship fields opens, then
  // memoised for the session so opening/closing the editor doesn't re-fetch.
  const [relOptions, setRelOptions] = useState<Record<string, Array<{ id: string; label: string }>>>({})
  const relTargetsNeeded = useMemo(() => {
    const out = new Set<string>()
    const walk = (fields: FieldDef[]) => {
      for (const f of fields) {
        if ((f.type === 'relationship' || f.type === 'relationshipMany') && f.relationTo) {
          out.add(f.relationTo)
        }
        if (f.type === 'array' && f.fields) walk(f.fields)
      }
    }
    walk(config.fields)
    return [...out]
  }, [config])

  useEffect(() => {
    if (!editing) return
    const missing = relTargetsNeeded.filter((slug) => !(slug in relOptions))
    if (!missing.length) return
    let cancelled = false
    ;(async () => {
      const updates: Record<string, Array<{ id: string; label: string }>> = {}
      for (const slug of missing) {
        try {
          const sort = slug === 'media' ? 'filename' : 'name'
          const resp = await authFetch(`/api/${slug}?limit=300&depth=0&sort=${sort}`)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = await resp.json()
          updates[slug] = (data.docs ?? []).map((d: Record<string, unknown>) => ({
            id: String(d.id),
            label: relLabel(d),
          }))
        } catch {
          updates[slug] = []  // fall back to empty list; the picker still renders
        }
      }
      if (!cancelled) setRelOptions((prev) => ({ ...prev, ...updates }))
    })()
    return () => { cancelled = true }
  }, [editing, relTargetsNeeded, relOptions])

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
      // Strip id from body for create, and normalize empties + relationships
      const body: Record<string, unknown> = {}
      for (const f of config.fields) {
        const v = editing[f.name]
        if (f.type === 'number' && v === '') continue
        if (f.type === 'relationship') {
          // Payload accepts the id directly; omit when empty so the field
          // stays null rather than being assigned an empty string.
          const id = relId(v)
          if (id) body[f.name] = id
          continue
        }
        if (f.type === 'relationshipMany') {
          body[f.name] = Array.isArray(v) ? v.map(relId).filter(Boolean) : []
          continue
        }
        if (f.type === 'array') {
          // Drop the synthetic `id` Payload may have added on existing items
          // so the API doesn't reject unknown IDs on subsequent saves.
          body[f.name] = Array.isArray(v)
            ? v.map((item) => {
                if (item && typeof item === 'object') {
                  const { id: _omit, ...rest } = item as Record<string, unknown>
                  return rest
                }
                return item
              })
            : []
          continue
        }
        body[f.name] = v
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
                  {f.label ?? f.name}
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
                ) : f.type === 'relationship' ? (
                  <select
                    required={f.required}
                    value={relId(value)}
                    onChange={(e) => onChange(e.target.value || null)}
                    className={common}
                  >
                    <option value="">—</option>
                    {(relOptions[f.relationTo ?? ''] ?? []).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === 'relationshipMany' ? (
                  <RelationshipManyEditor
                    selected={Array.isArray(value) ? (value as unknown[]).map(relId).filter(Boolean) : []}
                    options={relOptions[f.relationTo ?? ''] ?? []}
                    onChange={(next) => onChange(next)}
                  />
                ) : f.type === 'array' ? (
                  <ArrayEditor
                    items={Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []}
                    subFields={f.fields ?? []}
                    relOptions={relOptions}
                    onChange={(next) => onChange(next)}
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
          placeholder={`Filter by ${config.columns[0]}…`}
          className="w-64 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-[color:var(--color-border)]">
                {config.columns.map((c) => <th key={c} className="py-2 pr-3">{c}</th>)}
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  {config.columns.map((c) => (
                    <td key={c} className="py-2 pr-3">{renderCell(r[c])}</td>
                  ))}
                  <td className="py-2 pr-3 space-x-2">
                    <button onClick={() => setEditing(r)} className="rounded bg-[color:var(--color-brand)] px-2 py-1 text-xs text-white hover:opacity-90">Edit</button>
                    <button onClick={() => remove(r.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-[color:var(--color-text-muted)]">No records.</p>
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
      { name: 'name', type: 'text', required: true },
      { name: 'type', type: 'select', required: true, options: [
        { label: 'Supreme', value: 'supreme' },
        { label: 'County', value: 'county' },
        { label: 'Municipal', value: 'municipal' },
        { label: 'Commercial', value: 'commercial' },
        { label: 'High commercial', value: 'high_commercial' },
        { label: 'Administrative', value: 'administrative' },
        { label: 'Misdemeanour', value: 'misdemeanour' },
        { label: 'ECHR', value: 'echr' },
      ]},
      { name: 'address', type: 'text' },
      { name: 'city', type: 'text', required: true },
      { name: 'county', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'website', type: 'text' },
      { name: 'president', type: 'text' },
      {
        name: 'departments',
        type: 'array',
        label: 'Odjeli suda / Departments',
        fields: [
          { name: 'name', type: 'text', required: true, label: 'Naziv odjela' },
          { name: 'type', type: 'select', label: 'Vrsta odjela', options: [
            { label: 'Pisarnica / Registry', value: 'registry' },
            { label: 'Ured predsjednika / President’s office', value: 'president' },
            { label: 'Tajnik / Secretary', value: 'secretary' },
            { label: 'Glasnogovornik / Spokesperson', value: 'spokesperson' },
            { label: 'Ostalo / Other', value: 'other' },
          ]},
          { name: 'head', type: 'text', label: 'Voditelj / Head' },
          { name: 'phone', type: 'text', label: 'Telefon' },
          { name: 'email', type: 'text' },
          { name: 'notes', type: 'textarea', label: 'Napomene' },
        ],
      },
    ],
  },
  judges: {
    slug: 'judges',
    title: 'Judges',
    columns: ['name', 'specialization', 'status'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'specialization', type: 'text' },
      { name: 'appointmentDate', type: 'text', label: 'Appointment date (YYYY-MM-DD)' },
      { name: 'email', type: 'text' },
      { name: 'status', type: 'select', options: [
        { label: 'Active', value: 'active' },
        { label: 'Retired', value: 'retired' },
        { label: 'Other', value: 'other' },
      ]},
    ],
  },
  'expert-witnesses': {
    slug: 'expert-witnesses',
    title: 'Expert witnesses',
    columns: ['name', 'company', 'city', 'county', 'email'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'company', type: 'text', label: 'Tvrtka / Company' },
      { name: 'address', type: 'text' },
      { name: 'city', type: 'text', label: 'Grad / City' },
      { name: 'county', type: 'text', label: 'Županija / County' },
      { name: 'phone', type: 'text' },
      { name: 'email', type: 'text' },
      {
        name: 'specialityAreas',
        type: 'array',
        label: 'Speciality areas / Područja vještačenja',
        fields: [
          { name: 'area', type: 'text', required: true, label: 'Grana / Branch' },
          { name: 'subArea', type: 'text', label: 'Podgrana / Sub-branch' },
        ],
      },
      { name: 'cv', type: 'relationship', relationTo: 'media', label: 'Životopis / CV' },
      { name: 'works', type: 'relationshipMany', relationTo: 'media', label: 'Priloženi radovi / Works' },
    ],
  },
  interpreters: {
    slug: 'interpreters',
    title: 'Interpreters',
    columns: ['name', 'company', 'city', 'county', 'email'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'company', type: 'text', label: 'Tvrtka / Company' },
      { name: 'address', type: 'text' },
      { name: 'city', type: 'text', label: 'Grad / City' },
      { name: 'county', type: 'text', label: 'Županija / County' },
      { name: 'phone', type: 'text' },
      { name: 'email', type: 'text' },
      {
        name: 'languagePairs',
        type: 'array',
        label: 'Language pairs / Jezični parovi',
        fields: [
          { name: 'pair', type: 'text', required: true, label: 'Par (BCP-47, npr. hr-en)' },
        ],
      },
      { name: 'cv', type: 'relationship', relationTo: 'media', label: 'Životopis / CV' },
      { name: 'works', type: 'relationshipMany', relationTo: 'media', label: 'Priloženi radovi / Works' },
    ],
  },
  'state-attorneys': {
    slug: 'state-attorneys',
    title: 'State attorneys (DORH)',
    columns: ['name', 'city'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'city', type: 'text' },
      { name: 'address', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'email', type: 'text' },
    ],
  },
  'bankruptcy-administrators': {
    slug: 'bankruptcy-administrators',
    title: 'Bankruptcy administrators',
    columns: ['name', 'licenceNumber', 'city'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'licenceNumber', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'address', type: 'text' },
      { name: 'city', type: 'text' },
      { name: 'county', type: 'text' },
    ],
  },
  'bankruptcy-debtors': {
    slug: 'bankruptcy-debtors',
    title: 'Bankruptcy debtors / Stečajni dužnici',
    columns: ['name', 'oib', 'city', 'county'],
    fields: [
      { name: 'name', type: 'text', required: true, label: 'Naziv / Ime dužnika' },
      { name: 'oib', type: 'text', label: 'OIB' },
      { name: 'address', type: 'text', label: 'Adresa' },
      { name: 'city', type: 'text', label: 'Grad' },
      { name: 'county', type: 'text', label: 'Županija' },
      { name: 'phone', type: 'text', label: 'Telefon' },
      { name: 'email', type: 'text' },
      { name: 'notes', type: 'textarea', label: 'Bilješke' },
    ],
  },
  'bankruptcy-filings': {
    slug: 'bankruptcy-filings',
    title: 'Bankruptcy filings / Stečajni podnesci',
    columns: ['filingType', 'caseNumber', 'status', 'submittedBy'],
    fields: [
      { name: 'filingType', type: 'select', required: true, label: 'Vrsta podneska / Filing type', options: [
        { label: 'Motion to open / Prijedlog za pokretanje', value: 'motion-to-open' },
        { label: 'Prijava tražbine / Creditor claim', value: 'prijava-trazbine' },
        { label: 'Asset inventory / Popis imovine', value: 'asset-inventory' },
        { label: 'Asset sale / Prodaja imovine', value: 'asset-sale' },
        { label: 'Trustee report / Izvještaj stečajnog upravitelja', value: 'trustee-report' },
        { label: 'Distribution proposal / Prijedlog raspodjele', value: 'distribution-proposal' },
        { label: 'Final accounting / Završni račun', value: 'final-accounting' },
        { label: 'Restructuring plan / Plan restrukturiranja', value: 'restructuring-plan' },
        { label: 'Pre-bankruptcy settlement / Predstečajna nagodba', value: 'pre-bankruptcy-settlement' },
      ]},
      { name: 'caseNumber', type: 'text', label: 'Broj predmeta / Case number' },
      { name: 'status', type: 'select', required: true, options: [
        { label: 'Pending review', value: 'pending_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ]},
      { name: 'submittedBy', type: 'text', label: 'Submitted by (email)' },
      { name: 'attachmentFilename', type: 'text', label: 'Attachment filename' },
      { name: 'reviewNotes', type: 'textarea', label: 'Review notes' },
    ],
    defaults: { status: 'pending_review' },
  },
  laws: {
    slug: 'laws',
    title: 'Laws',
    columns: ['title', 'category', 'effectiveDate'],
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'category', type: 'text' },
      { name: 'effectiveDate', type: 'text', label: 'Effective date (YYYY-MM-DD)' },
      { name: 'officialGazette', type: 'text' },
      { name: 'summary', type: 'textarea' },
    ],
  },
  'legal-categories': {
    slug: 'legal-categories',
    title: 'Legal categories',
    columns: ['name', 'slug'],
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text' },
      { name: 'description', type: 'textarea' },
    ],
  },
  documents: {
    slug: 'documents',
    title: 'Documents',
    columns: ['title', 'category'],
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'textarea' },
      { name: 'category', type: 'text' },
    ],
  },
  pages: {
    slug: 'pages',
    title: 'Pages',
    columns: ['title', 'slug'],
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'content', type: 'textarea' },
    ],
  },
  'api-keys': {
    slug: 'api-keys',
    title: 'API keys',
    columns: ['label', 'key', 'active'],
    fields: [
      { name: 'label', type: 'text', required: true },
      { name: 'active', type: 'checkbox' },
    ],
  },
}

export default function AdminCollectionRoute({ slug }: { slug: keyof typeof collectionConfigs }) {
  const config = collectionConfigs[slug]
  if (!config) return <p className="text-red-600">Unknown collection: {slug}</p>
  return <AdminCollectionPage config={config} />
}
