import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface AuditEntry {
  id: number | string
  createdAt?: string
  actorEmail?: string
  actorId?: string
  action?: string
  targetCollection?: string
  targetId?: string
  summary?: string
  payload?: unknown
  ip?: string
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

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams({ limit: '50', page: String(page) })
    if (action) qs.set('action', action)
    const resp = await authFetch(`/api/admin/audit-log?${qs.toString()}`)
    if (resp.ok) {
      const d = await resp.json()
      setEntries(d.docs ?? [])
      setTotal(d.totalDocs ?? 0)
    } else {
      setError(`HTTP ${resp.status}`)
    }
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, action])

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Audit log ({total.toLocaleString()})</h2>
      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mb-4">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm">
          <option value="">All actions</option>
          <option value="user.role_change">User role change</option>
          <option value="user.unlock">User unlock</option>
          <option value="gdpr.export">GDPR export</option>
          <option value="gdpr.forget">GDPR forget</option>
          <option value="collection.create">Collection create</option>
          <option value="collection.update">Collection update</option>
          <option value="collection.delete">Collection delete</option>
        </select>
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && entries.length === 0 && <p className="text-[color:var(--color-text-muted)]">No audit entries.</p>}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Summary</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {entries.map((e) => {
                const isOpen = expanded === String(e.id)
                return (
                  <>
                    <tr key={e.id}>
                      <td className="py-2 pr-3 font-mono text-xs">{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td>
                      <td className="py-2 pr-3">{e.actorEmail ?? e.actorId}</td>
                      <td className="py-2 pr-3"><span className="font-mono text-xs">{e.action}</span></td>
                      <td className="py-2 pr-3 text-xs">{e.targetCollection ? `${e.targetCollection}/${e.targetId}` : '—'}</td>
                      <td className="py-2 pr-3">{e.summary ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <button onClick={() => setExpanded(isOpen ? null : String(e.id))} className="text-xs text-[color:var(--color-brand)] hover:underline">
                          {isOpen ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${e.id}-details`}>
                        <td colSpan={6} className="bg-[color:var(--color-surface-alt)] p-3">
                          <pre className="whitespace-pre-wrap text-xs overflow-x-auto">{JSON.stringify(e.payload, null, 2)}</pre>
                          {e.ip && <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">IP: {e.ip}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-3 py-1 text-sm disabled:opacity-50">← Prev</button>
        <span className="self-center text-sm">Page {page}</span>
        <button disabled={entries.length < 50} onClick={() => setPage(p => p + 1)} className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-3 py-1 text-sm disabled:opacity-50">Next →</button>
      </div>
    </div>
  )
}
