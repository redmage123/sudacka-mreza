import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface Listing {
  id: number | string
  caseNumber?: string | null
  debtorName?: string | null
  status?: string | null
  deadline?: string | null
  publishedAt?: string | null
  court?: { name?: string } | null
  assets?: Record<string, unknown> | null
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

export default function AdminBankruptcyPage() {
  const [docs, setDocs] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        limit: '50',
        sort: '-createdAt',
        'where[status][equals]': 'pending_review',
      })
      const resp = await authFetch(`/api/bankruptcy-listings?${qs.toString()}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setDocs(data.docs ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: Listing['id'], status: 'active' | 'rejected') {
    setBusy(`${status}-${id}`)
    try {
      const resp = await authFetch(`/api/bankruptcy-listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">
        Pending bankruptcy listings ({docs.length})
      </h2>
      {error && (
        <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && docs.length === 0 && (
        <p className="text-[color:var(--color-text-muted)]">No pending listings to review.</p>
      )}

      {!loading && docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((l) => (
            <div key={l.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[color:var(--color-heading)]">{l.debtorName ?? '(no debtor)'}</div>
                  <div className="text-sm text-[color:var(--color-text-muted)]">
                    {l.caseNumber && <span className="font-mono">{l.caseNumber}</span>}
                    {l.court?.name && <span> · {l.court.name}</span>}
                  </div>
                  {typeof l.assets?.raw_text_excerpt === 'string' && l.assets.raw_text_excerpt.length > 0 ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-[color:var(--color-brand)]">Source excerpt</summary>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded p-2 max-h-48 overflow-y-auto">
                        {l.assets.raw_text_excerpt}
                      </pre>
                    </details>
                  ) : null}
                  <div className="text-xs text-[color:var(--color-text-muted)] mt-2">
                    Confidence: {(() => {
                      const c = l.assets?.confidence
                      return typeof c === 'number' ? (c * 100).toFixed(0) + '%' : '—'
                    })()}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    disabled={busy === `active-${l.id}`}
                    onClick={() => setStatus(l.id, 'active')}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve & publish
                  </button>
                  <button
                    disabled={busy === `rejected-${l.id}`}
                    onClick={() => setStatus(l.id, 'rejected')}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
