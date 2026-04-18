import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface FlaggedItem {
  id: number | string
  name?: string
  flags: Array<{ reason?: string; createdAt?: string; reporter?: { email?: string } | null }>
  collection: 'expert-witnesses' | 'interpreters'
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

async function fetchFlags(collection: 'expert-witnesses' | 'interpreters'): Promise<FlaggedItem[]> {
  const qs = new URLSearchParams({ limit: '100', sort: '-updatedAt', depth: '1' })
  const resp = await authFetch(`/api/${collection}?${qs.toString()}`)
  if (!resp.ok) return []
  const data = await resp.json()
  const docs = (data.docs ?? []) as Array<Record<string, unknown>>
  return docs
    .filter((d) => Array.isArray(d.flagReports) && (d.flagReports as unknown[]).length > 0)
    .map((d) => ({
      id: d.id as number | string,
      name: d.name as string | undefined,
      flags: (d.flagReports as FlaggedItem['flags']),
      collection,
    }))
}

export default function AdminFlagsPage() {
  const [items, setItems] = useState<FlaggedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [experts, interps] = await Promise.all([
      fetchFlags('expert-witnesses'),
      fetchFlags('interpreters'),
    ])
    setItems([...experts, ...interps])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function clearFlags(item: FlaggedItem) {
    setBusy(`${item.collection}-${item.id}`)
    try {
      await authFetch(`/api/${item.collection}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ flagReports: [] }),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">
        Flag reports ({items.length})
      </h2>
      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-[color:var(--color-text-muted)]">No flagged experts or interpreters.</p>
      )}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.collection}-${item.id}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-[color:var(--color-heading)]">{item.name ?? '(no name)'}</div>
                  <div className="text-xs text-[color:var(--color-text-muted)] mb-2">{item.collection} #{item.id}</div>
                  <ul className="text-sm space-y-1">
                    {item.flags.map((f, i) => (
                      <li key={i} className="text-[color:var(--color-text-muted)]">
                        {f.reason ?? '(no reason)'}{' '}
                        {f.reporter?.email && <span className="text-xs">· reported by {f.reporter.email}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  disabled={busy === `${item.collection}-${item.id}`}
                  onClick={() => clearFlags(item)}
                  className="rounded bg-[color:var(--color-brand)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                >
                  Dismiss flags
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
