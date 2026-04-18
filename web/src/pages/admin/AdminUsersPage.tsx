import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface User {
  id: number | string
  email: string
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  role?: string | null
  _verified?: boolean
  lockUntil?: string | null
  loginAttempts?: number | null
  createdAt?: string
}

interface ListResponse {
  docs: User[]
  totalDocs: number
  page: number
  totalPages: number
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: '25', page: String(page), sort: '-createdAt' })
      if (q) qs.set('where[email][like]', q)
      const resp = await authFetch(`/api/users?${qs.toString()}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: ListResponse = await resp.json()
      setUsers(data.docs)
      setTotal(data.totalDocs)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  async function updateRole(id: User['id'], role: string) {
    setBusy(`role-${id}`)
    try {
      const resp = await authFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setFlash(`Role updated to "${role}"`)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function unlock(id: User['id']) {
    setBusy(`unlock-${id}`)
    try {
      const resp = await authFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ loginAttempts: 0, lockUntil: null }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setFlash('Account unlocked')
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function gdprExport(id: User['id'], email: string) {
    setBusy(`export-${id}`)
    try {
      const resp = await authFetch(`/api/admin/gdpr/export/${id}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr-export-${email.replace(/[^a-z0-9]/gi, '_')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setFlash('GDPR export downloaded')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function gdprForget(id: User['id'], email: string) {
    const ack = window.prompt(
      `Type "${email}" to confirm irreversible GDPR deletion of this account and all linked personal data.`
    )
    if (ack !== email) return
    setBusy(`forget-${id}`)
    try {
      const resp = await authFetch(`/api/admin/gdpr/forget/${id}`, { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setFlash(`User ${email} and their personal data deleted`)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Users ({total.toLocaleString()})</h2>

      {flash && (
        <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder="Filter by email…"
          className="w-64 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="py-2 pr-3">Email / username</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {users.map((u) => {
                const locked = u.lockUntil && new Date(u.lockUntil) > new Date()
                return (
                  <tr key={u.id}>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{u.email}</div>
                      {u.username && <div className="text-xs text-[color:var(--color-text-muted)]">@{u.username}</div>}
                    </td>
                    <td className="py-2 pr-3">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={u.role ?? 'member'}
                        disabled={busy === `role-${u.id}`}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-sm"
                      >
                        <option value="member">member</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      {locked ? (
                        <span className="text-red-600">locked</span>
                      ) : u._verified === false ? (
                        <span className="text-amber-600">unverified</span>
                      ) : (
                        <span className="text-green-700 dark:text-green-400">active</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 space-x-2">
                      {locked && (
                        <button
                          disabled={busy === `unlock-${u.id}`}
                          onClick={() => unlock(u.id)}
                          className="rounded bg-amber-500 px-2 py-1 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          Unlock
                        </button>
                      )}
                      <button
                        disabled={busy === `export-${u.id}`}
                        onClick={() => gdprExport(u.id, u.email)}
                        className="rounded bg-[color:var(--color-brand)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                        title="Download all of this user's personal data as JSON (GDPR Art. 15)"
                      >
                        Export
                      </button>
                      <button
                        disabled={busy === `forget-${u.id}`}
                        onClick={() => gdprForget(u.id, u.email)}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        title="GDPR Art. 17 — irreversibly delete this user and all personal data linked to them"
                      >
                        Forget
                      </button>
                    </td>
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
