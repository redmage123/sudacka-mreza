import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

interface Filing {
  id: number | string
  filingType?: string
  caseNumber?: string | null
  status?: string
  submittedBy?: string | null
  data?: Record<string, unknown> | null
  createdAt?: string
}

const TYPE_LABELS: Record<string, string> = {
  'motion-to-open':             '⚖️ Motion to open',
  'prijava-trazbine':           '💰 Creditor claim',
  'asset-inventory':            '📋 Asset inventory',
  'asset-sale':                 '🔨 Asset sale',
  'trustee-report':             '📑 Trustee report',
  'distribution-proposal':      '📊 Distribution',
  'final-accounting':           '🧾 Final accounting',
  'restructuring-plan':         '🔧 Restructuring',
  'pre-bankruptcy-settlement':  '🤝 Pre-settlement',
}

export default function EditorPendingPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Filing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    const token = getAuthToken()
    const qs = new URLSearchParams({
      limit: '50',
      sort: '-createdAt',
      'where[submittedBy][equals]': user.email,
    })
    fetch(`/api/bankruptcy-filings?${qs.toString()}`, {
      headers: token ? { Authorization: `JWT ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : { docs: [] })
      .then((d) => setRows(d.docs ?? []))
      .finally(() => setLoading(false))
  }, [user?.email])

  function statusLabel(s?: string) {
    if (s === 'approved') return { text: 'Approved', className: 'text-green-700 dark:text-green-400' }
    if (s === 'rejected') return { text: 'Rejected', className: 'text-red-600' }
    if (s === 'pending_review') return { text: 'Pending review', className: 'text-amber-600' }
    return { text: s ?? '—', className: 'text-[color:var(--color-text-muted)]' }
  }

  function debtorOf(r: Filing): string {
    const d = r.data
    if (d && typeof d === 'object') {
      const name = (d as Record<string, unknown>)['debtor_name']
      if (typeof name === 'string' && name.trim()) return name
    }
    return '—'
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
                <th className="py-2 pr-3">Type</th>
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
                    <td className="py-2 pr-3">{TYPE_LABELS[r.filingType ?? ''] ?? r.filingType ?? '—'}</td>
                    <td className="py-2 pr-3">{debtorOf(r)}</td>
                    <td className="py-2 pr-3 font-mono">{r.caseNumber ?? '—'}</td>
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
