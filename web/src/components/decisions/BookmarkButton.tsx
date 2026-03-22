import { useState, useEffect, useCallback, useRef } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { getBookmarks, createBookmark, deleteBookmark } from '@/api/bookmarks'

interface Props {
  decisionId: string
}

const PRESET_FOLDERS = [
  'Opće',
  'Kazneni predmeti',
  'Građansko pravo',
  'Trgovačko pravo',
  'Upravno pravo',
  'Ustavno pravo',
  'Europsko pravo',
]

export function BookmarkButton({ decisionId }: Props) {
  const [bookmarkId, setBookmarkId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [showFolder, setShowFolder] = useState(false)
  const [folder, setFolder] = useState('Opće')
  const [customFolder, setCustomFolder] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Load existing bookmark on mount ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBookmarks(decisionId)
      .then((bms) => {
        if (!cancelled) setBookmarkId(bms[0]?.id ?? null)
      })
      .catch(() => { /* unauthenticated — no bookmarks */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [decisionId])

  // ── Close dropdown when clicking outside ─────────────────────────────────

  useEffect(() => {
    if (!showFolder) return
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFolder(false)
      }
    }
    window.addEventListener('mousedown', onOutside)
    return () => window.removeEventListener('mousedown', onOutside)
  }, [showFolder])

  // ── Remove bookmark ───────────────────────────────────────────────────────

  const handleRemove = useCallback(async () => {
    if (!bookmarkId) return
    setToggling(true)
    try {
      await deleteBookmark(bookmarkId)
      setBookmarkId(null)
    } finally {
      setToggling(false)
    }
  }, [bookmarkId])

  // ── Save new bookmark ─────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const targetFolder = customFolder.trim() || folder
    setToggling(true)
    setShowFolder(false)
    try {
      const bm = await createBookmark(decisionId, targetFolder)
      setBookmarkId(bm.id)
    } finally {
      setToggling(false)
    }
  }, [decisionId, folder, customFolder])

  // ── Main button click ─────────────────────────────────────────────────────

  const handleClick = () => {
    if (loading || toggling) return
    if (bookmarkId) {
      handleRemove()
    } else {
      setShowFolder(true)
    }
  }

  const isBookmarked = Boolean(bookmarkId)

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || toggling}
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? 'Ukloni iz knjižnice' : 'Dodaj u knjižnicu'}
        className={[
          'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isBookmarked
            ? 'bg-[color:var(--color-brand-navy)] text-white hover:bg-[color:var(--color-brand-navy-light)]'
            : 'border border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-subtle)]',
        ].join(' ')}
      >
        {isBookmarked ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        )}
        {toggling ? 'Sprema…' : isBookmarked ? 'U knjižnici' : 'Dodaj u knjižnicu'}
      </button>

      {/* Folder selector dropdown */}
      {showFolder && (
        <div
          className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg"
          role="dialog"
          aria-label="Odabir mape"
        >
          <div className="border-b border-[color:var(--color-border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              Spremi u mapu
            </p>
          </div>

          {/* Preset folders */}
          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
            {PRESET_FOLDERS.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  role="option"
                  aria-selected={folder === f}
                  onClick={() => setFolder(f)}
                  className={[
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    folder === f
                      ? 'bg-[color:var(--color-surface-subtle)] font-medium text-[color:var(--color-text)]'
                      : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-subtle)]',
                  ].join(' ')}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>

          {/* Custom folder input */}
          <div className="border-t border-[color:var(--color-border)] px-3 py-2">
            <input
              type="text"
              placeholder="Nova mapa…"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-border-focus)]"
              aria-label="Nova mapa"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-[color:var(--color-border)] px-3 py-2">
            <button
              type="button"
              onClick={() => setShowFolder(false)}
              className="flex-1 rounded px-3 py-1.5 text-sm text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-subtle)] transition-colors"
            >
              Odustani
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded bg-[color:var(--color-brand-navy)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--color-brand-navy-light)] transition-colors"
            >
              Spremi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
