import { useEffect, useRef, useState } from 'react'
import { getAuthToken } from '@/api/client'

interface Media {
  id: number | string
  filename?: string
  mimeType?: string
  filesize?: number
  url?: string
  alt?: string
  width?: number
  height?: number
  createdAt?: string
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  return fetch(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `JWT ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export default function AdminMediaPage() {
  const [items, setItems] = useState<Media[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const resp = await authFetch('/api/media?limit=60&sort=-createdAt')
    if (resp.ok) {
      const d = await resp.json()
      setItems(d.docs ?? [])
      setTotal(d.totalDocs ?? 0)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function upload(files: FileList | File[]) {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    setError(null)
    setFlash(null)
    let ok = 0
    let fail = 0
    for (const file of arr) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('alt', file.name)
      try {
        const resp = await authFetch('/api/media', { method: 'POST', body: fd })
        if (resp.ok) ok++
        else {
          const errBody = await resp.json().catch(() => ({}))
          fail++
          setError(`${file.name}: ${errBody?.errors?.[0]?.message ?? `HTTP ${resp.status}`}`)
        }
      } catch (e) {
        fail++
        setError(`${file.name}: ${String(e)}`)
      }
    }
    setUploading(false)
    if (ok > 0) setFlash(`Uploaded ${ok}${fail ? ` (${fail} failed)` : ''}`)
    await load()
  }

  async function remove(id: Media['id']) {
    if (!window.confirm('Delete this media?')) return
    const resp = await authFetch(`/api/media/${id}`, { method: 'DELETE' })
    if (resp.ok) {
      setFlash('Deleted.')
      await load()
    } else {
      setError(`Delete failed: HTTP ${resp.status}`)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Media ({total.toLocaleString()})</h2>

      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}
      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files) upload(e.dataTransfer.files)
        }}
        className={`mb-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? 'border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/10'
            : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)]'
        }`}
      >
        <p className="text-sm text-[color:var(--color-text-muted)] mb-2">
          Drag files here or
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Choose files'}
        </button>
      </div>

      {loading && <p className="text-[color:var(--color-text-muted)]">Loading…</p>}

      {!loading && items.length === 0 && <p className="text-[color:var(--color-text-muted)]">No media yet.</p>}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <div key={m.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] overflow-hidden">
              {m.mimeType?.startsWith('image/') && m.url ? (
                <img src={m.url} alt={m.alt ?? ''} className="h-32 w-full object-cover" />
              ) : (
                <div className="h-32 w-full flex items-center justify-center text-[color:var(--color-text-muted)] text-sm">
                  {m.mimeType ?? 'file'}
                </div>
              )}
              <div className="p-2">
                <p className="truncate text-xs font-medium" title={m.filename}>{m.filename}</p>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  {m.filesize ? `${(m.filesize / 1024).toFixed(0)} KB` : ''}
                </p>
                <div className="mt-1 flex justify-between text-xs">
                  {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--color-brand)] hover:underline">Open</a>}
                  <button onClick={() => remove(m.id)} className="text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
