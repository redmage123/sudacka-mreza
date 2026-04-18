import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

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

// Payload global-doc editor — loads the JSON representation of a global and
// lets an admin edit it as raw JSON. Safer than a schema-derived form for
// fields that change over time; the JSON is validated by Payload on save.
export default function AdminGlobalsPage() {
  const globals = ['settings', 'navigation']
  const [active, setActive] = useState<string>(globals[0])
  const [data, setData] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load(slug: string) {
    setLoading(true)
    setError(null)
    setFlash(null)
    try {
      const resp = await authFetch(`/api/globals/${slug}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      setData(JSON.stringify(json, null, 2))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(active) }, [active])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        setError('Invalid JSON — fix syntax before saving.')
        setSaving(false)
        return
      }
      const resp = await authFetch(`/api/globals/${active}`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setFlash('Saved.')
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Site globals</h2>

      <div className="mb-4 flex gap-2">
        {globals.map((g) => (
          <button
            key={g}
            onClick={() => setActive(g)}
            className={`rounded px-3 py-1.5 text-sm capitalize ${
              active === g
                ? 'bg-[color:var(--color-brand)] text-white font-semibold'
                : 'bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}
      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      {loading ? (
        <p className="text-[color:var(--color-text-muted)]">Loading…</p>
      ) : (
        <div>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={24}
            spellCheck={false}
            className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-xs font-mono"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={saving} className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => load(active)} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-4 py-2 text-sm">
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
