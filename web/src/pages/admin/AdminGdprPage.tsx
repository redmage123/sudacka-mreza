import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getAuthToken } from '@/api/client'

interface Subject {
  userId: string | null
  email: string
  summary: Record<string, number>
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

export default function AdminGdprPage() {
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSubject(null)
    try {
      const resp = await authFetch(`/api/admin/gdpr/lookup?email=${encodeURIComponent(email)}`)
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('No user found for that email.')
        throw new Error(`HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setSubject(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function download() {
    if (!subject?.userId) return
    const resp = await authFetch(`/api/admin/gdpr/export/${subject.userId}`)
    if (!resp.ok) { setError(`Export failed: HTTP ${resp.status}`); return }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gdpr-export-${subject.email.replace(/[^a-z0-9]/gi, '_')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function forget() {
    if (!subject?.userId) return
    const ack = window.prompt(`Type "${subject.email}" to confirm irreversible deletion.`)
    if (ack !== subject.email) return
    const resp = await authFetch(`/api/admin/gdpr/forget/${subject.userId}`, { method: 'POST' })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      setError(`Forget failed: ${err?.errors?.[0]?.message ?? resp.status}`)
      return
    }
    setSubject(null)
    setEmail('')
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2 text-[color:var(--color-heading)]">GDPR data subject requests</h2>
      <p className="text-sm text-[color:var(--color-text-muted)] mb-6">
        Look up personal data by email address. Export fulfils <Link to={`/${locale}/privatnost`} className="underline">Art. 15 (right of access)</Link>;
        Forget fulfils Art. 17 (right to erasure) by anonymising related records and hard-deleting the user.
      </p>

      <form onSubmit={lookup} className="flex items-end gap-3 mb-6">
        <div className="flex-1 max-w-sm">
          <label className="block text-sm font-medium mb-1">Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Look up'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {subject && subject.userId && (
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
          <h3 className="font-semibold text-[color:var(--color-heading)] mb-3">{subject.email}</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm mb-4 sm:grid-cols-3">
            {Object.entries(subject.summary).map(([k, n]) => (
              <div key={k}>
                <dt className="text-xs text-[color:var(--color-text-muted)]">{k}</dt>
                <dd className="font-mono">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-3">
            <button
              onClick={download}
              className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Download export (JSON)
            </button>
            <button
              onClick={forget}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Execute right to erasure
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
