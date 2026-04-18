import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getAuthToken } from '@/api/client'

interface Counts {
  users: number
  bankruptcyListings: number
  bankruptcyPending: number
  courts: number
  courtDecisions: number
  experts: number
  interpreters: number
  judges: number
  newsPosts: number
  subscriptions: number
}

async function fetchCount(collection: string, where?: string): Promise<number> {
  const token = getAuthToken()
  const qs = new URLSearchParams({ limit: '1' })
  if (where) {
    const parts = where.split('&')
    for (const p of parts) {
      const [k, v] = p.split('=')
      if (k && v) qs.set(k, decodeURIComponent(v))
    }
  }
  const resp = await fetch(`/api/${collection}?${qs.toString()}`, {
    headers: token ? { Authorization: `JWT ${token}` } : {},
  })
  if (!resp.ok) return 0
  const json = await resp.json()
  return typeof json.totalDocs === 'number' ? json.totalDocs : 0
}

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchCount('users'),
      fetchCount('bankruptcy-listings'),
      fetchCount('bankruptcy-listings', 'where[status][equals]=pending_review'),
      fetchCount('courts'),
      fetchCount('court-decisions'),
      fetchCount('expert-witnesses'),
      fetchCount('interpreters'),
      fetchCount('judges'),
      fetchCount('news-posts'),
      fetchCount('subscriptions'),
    ])
      .then(([u, b, bp, c, cd, e, i, j, n, s]) => {
        if (alive) setCounts({
          users: u, bankruptcyListings: b, bankruptcyPending: bp,
          courts: c, courtDecisions: cd, experts: e, interpreters: i,
          judges: j, newsPosts: n, subscriptions: s,
        })
      })
      .catch((e) => alive && setErr(String(e)))
    return () => { alive = false }
  }, [])

  if (err) return <p className="text-red-600">Failed to load counts: {err}</p>
  if (!counts) return <p className="text-[color:var(--color-text-muted)]">Loading…</p>

  const cards: Array<{ label: string; value: number; href?: string; highlight?: boolean }> = [
    { label: 'Users', value: counts.users, href: `/${locale}/admin/users` },
    { label: 'Pending bankruptcy listings', value: counts.bankruptcyPending, href: `/${locale}/admin/bankruptcy`, highlight: counts.bankruptcyPending > 0 },
    { label: 'Bankruptcy listings (total)', value: counts.bankruptcyListings },
    { label: 'Court decisions', value: counts.courtDecisions },
    { label: 'Courts', value: counts.courts },
    { label: 'Judges', value: counts.judges },
    { label: 'Expert witnesses', value: counts.experts },
    { label: 'Interpreters', value: counts.interpreters },
    { label: 'News posts', value: counts.newsPosts, href: `/${locale}/admin/news` },
    { label: 'Email subscriptions', value: counts.subscriptions },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Site overview</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const content = (
            <div className={`rounded-lg border p-4 ${
              c.highlight
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)]'
            }`}>
              <p className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-[color:var(--color-heading)]">{c.value.toLocaleString()}</p>
            </div>
          )
          return c.href ? (
            <Link key={c.label} to={c.href} className="block hover:opacity-90 transition-opacity">
              {content}
            </Link>
          ) : (
            <div key={c.label}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
