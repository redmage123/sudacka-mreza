import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

interface Listing {
  id: number | string
  debtorName?: string
  caseNumber?: string
  status?: string
  createdAt?: string
  assets?: { submitted_by?: string; pdf_media_id?: number | string } | null
}

export default function EditorPendingPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    const token = getAuthToken()
    // Find listings submitted by this editor (assets.submitted_by).
    // Payload JSONB query: where[assets.submitted_by][equals]=<email>
    const qs = new URLSearchParams({
      limit: '50',
      sort: '-createdAt',
      'where[assets.submitted_by][equals]': user.email,
    })
    fetch(`/api/bankruptcy-listings?${qs.toString()}`, {
      headers: token ? { Authorization: `JWT ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : { docs: [] })
      .then((d) => setRows(d.docs ?? []))
      .finally(() => setLoading(false))
  }, [user?.email])

  function statusLabel(s?: string) {
    if (s === 'active') return { text: 'Approved & published', className: 'text-green-700 dark:text-green-400' }
    if (s === 'rejected') return { text: 'Rejected', className: 'text-red-600' }
    if (s === 'pending_review') return { text: 'Pending review', className: 'text-amber-600' }
    return { text: s ?? '—', className: 'text-[color:var(--color-text-muted)]' }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">My pending submissions</h2>
      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-[color:var(--color-text-muted)]">You haven't submitted anything yet.</p>
      )}
      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="py-2 pr-3">Submitted</th>
                <th className="py-2 pr-3">Debtor</th>
                <th className="py-2 pr-3">Case #</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {rows.map((r) => {
                const s = statusLabel(r.status)
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-mono text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3">{r.debtorName ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono">{r.caseNumber}</td>
                    <td className={`py-2 pr-3 ${s.className}`}>{s.text}</td>
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
