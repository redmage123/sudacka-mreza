import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface Filing {
  id: number | string
  filingType?: string
  caseNumber?: string | null
  status?: string
  submittedBy?: string
  attachmentFilename?: string | null
  attachmentBase64?: string | null
  data?: Record<string, unknown>
  createdAt?: string
  reviewNotes?: string | null
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

export default function AdminFilingsPage() {
  const [docs, setDocs] = useState<Filing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('pending_review')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: '100', sort: '-createdAt' })
      if (statusFilter) qs.set('where[status][equals]', statusFilter)
      if (typeFilter) qs.set('where[filingType][equals]', typeFilter)
      if (search) {
        // Searches case number + submitter email + any JSON data field via OR
        qs.set('where[or][0][caseNumber][like]', search)
        qs.set('where[or][1][submittedBy][like]', search)
        qs.set('where[or][2][data.debtor_name][like]', search)
        qs.set('where[or][3][data.creditor_name][like]', search)
        qs.set('where[or][4][data.trustee_name][like]', search)
      }
      const resp = await authFetch(`/api/bankruptcy-filings?${qs.toString()}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setDocs(data.docs ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, typeFilter, search])

  async function setStatus(id: Filing['id'], status: 'approved' | 'rejected', notes?: string) {
    setBusy(`${status}-${id}`)
    try {
      const body: Record<string, unknown> = { status }
      if (notes) body.reviewNotes = notes
      const resp = await authFetch(`/api/bankruptcy-filings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  function downloadAttachment(d: Filing) {
    if (!d.attachmentBase64 || !d.attachmentFilename) return
    const bytes = Uint8Array.from(atob(d.attachmentBase64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = d.attachmentFilename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[color:var(--color-heading)] mb-4">
        Bankruptcy filings ({docs.length})
      </h2>

      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm">
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All statuses</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input
          type="search"
          placeholder="Search case #, submitter, debtor, creditor, trustee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[280px] max-w-lg rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}
      {!loading && docs.length === 0 && <p className="text-[color:var(--color-text-muted)]">No filings.</p>}

      {!loading && docs.length > 0 && (
        <div className="space-y-3">
          {docs.map((d) => {
            const isOpen = open === String(d.id)
            return (
              <div key={d.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[color:var(--color-heading)]">
                      {TYPE_LABELS[d.filingType ?? ''] ?? d.filingType}
                      {d.caseNumber && <span className="ml-2 font-mono text-sm text-[color:var(--color-text-muted)]">{d.caseNumber}</span>}
                    </div>
                    <div className="text-xs text-[color:var(--color-text-muted)] mt-1">
                      {d.submittedBy ?? '—'} · {d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'} · status: {d.status}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => setOpen(isOpen ? null : String(d.id))}
                      className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-xs">
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                    {d.attachmentFilename && (
                      <>
                        <button onClick={() => setViewing(viewing === String(d.id) ? null : String(d.id))}
                          className="rounded bg-[color:var(--color-brand)] px-2 py-1 text-xs text-white">
                          {viewing === String(d.id) ? 'Hide PDF' : 'View PDF'}
                        </button>
                        <button onClick={() => downloadAttachment(d)}
                          className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-xs">
                          Download
                        </button>
                      </>
                    )}
                    {d.status === 'pending_review' && (
                      <>
                        <button disabled={busy === `approved-${d.id}`} onClick={() => setStatus(d.id, 'approved')}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
                          Approve
                        </button>
                        <button disabled={busy === `rejected-${d.id}`} onClick={() => {
                          const notes = window.prompt('Reason for rejection?')
                          if (notes != null) setStatus(d.id, 'rejected', notes)
                        }}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <pre className="mt-3 whitespace-pre-wrap text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded p-2 max-h-96 overflow-y-auto">
{JSON.stringify(d.data, null, 2)}
                  </pre>
                )}
                {viewing === String(d.id) && d.attachmentBase64 && (
                  <div className="mt-3">
                    <iframe
                      src={`data:application/pdf;base64,${d.attachmentBase64}`}
                      className="w-full h-[70vh] border border-[color:var(--color-border)] rounded"
                      title={`${d.attachmentFilename ?? 'document'} — viewer`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
