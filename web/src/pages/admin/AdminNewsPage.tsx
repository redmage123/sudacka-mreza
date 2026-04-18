import { useEffect, useState } from 'react'
import { getAuthToken } from '@/api/client'
import MarkdownEditor from '@/components/admin/MarkdownEditor'

interface NewsDoc {
  id: number | string
  title?: string
  slug?: string
  excerpt?: string
  body?: string
  publishedAt?: string
  updatedAt?: string
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

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<NewsDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', slug: '', excerpt: '', body: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    const resp = await authFetch('/api/news-posts?limit=50&sort=-updatedAt')
    if (resp.ok) {
      const data = await resp.json()
      setPosts(data.docs ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const resp = await authFetch('/api/news-posts', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title,
          slug: draft.slug || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          excerpt: draft.excerpt,
          content: draft.body,
          publishedAt: new Date().toISOString(),
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setFlash('News post published.')
      setDraft({ title: '', slug: '', excerpt: '', body: '' })
      setShowNew(false)
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: NewsDoc['id']) {
    if (!window.confirm('Delete this post?')) return
    const resp = await authFetch(`/api/news-posts/${id}`, { method: 'DELETE' })
    if (resp.ok) {
      setFlash('Post deleted.')
      await load()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[color:var(--color-heading)]">News posts ({posts.length})</h2>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded bg-[color:var(--color-brand)] px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          {showNew ? 'Cancel' : '+ New post'}
        </button>
      </div>

      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}
      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      {showNew && (
        <form onSubmit={create} className="mb-6 space-y-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug (auto if blank)</label>
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Excerpt</label>
            <textarea rows={2} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Body</label>
            <MarkdownEditor value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} />
          </div>
          <button type="submit" disabled={submitting}
            className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
        </form>
      )}

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}
      {!loading && posts.length === 0 && !showNew && (
        <p className="text-[color:var(--color-text-muted)]">No posts yet.</p>
      )}
      {!loading && posts.length > 0 && (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-3 py-2">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-[color:var(--color-text-muted)]">
                  {p.slug} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : 'unpublished'}
                </div>
              </div>
              <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
