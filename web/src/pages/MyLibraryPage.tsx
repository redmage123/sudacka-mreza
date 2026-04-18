import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookmarkCheck, StickyNote, FolderOpen, ChevronRight, Trash2 } from 'lucide-react'
import { getBookmarks, deleteBookmark } from '@/api/bookmarks'
import type { Bookmark } from '@/api/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bookmarkDecisionId(bm: Bookmark): string {
  return typeof bm.decision === 'string' ? bm.decision : bm.decision.id
}

function bookmarkDecisionTitle(bm: Bookmark): string {
  return typeof bm.decision === 'string' ? bm.decision : (bm.decision.title ?? bm.decision.id)
}

function bookmarkDecisionCase(bm: Bookmark): string | undefined {
  return typeof bm.decision === 'string' ? undefined : bm.decision.caseNumber
}

function groupByFolder(bookmarks: Bookmark[], defaultFolder: string): Record<string, Bookmark[]> {
  return bookmarks.reduce<Record<string, Bookmark[]>>((acc, bm) => {
    const key = bm.folder ?? defaultFolder
    if (!acc[key]) acc[key] = []
    acc[key].push(bm)
    return acc
  }, {})
}

// ─── BookmarkCard ─────────────────────────────────────────────────────────────

interface BookmarkCardProps {
  bookmark: Bookmark
  lang: string
  onDelete: (id: string) => void
}

function BookmarkCard({ bookmark, lang, onDelete }: BookmarkCardProps) {
  const { t } = useTranslation('common')
  const [deleting, setDeleting] = useState(false)
  const decisionId = bookmarkDecisionId(bookmark)
  const title = bookmarkDecisionTitle(bookmark)
  const caseNum = bookmarkDecisionCase(bookmark)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteBookmark(bookmark.id)
      onDelete(bookmark.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 hover:border-[color:var(--color-brand-navy)] transition-colors">
      <div className="min-w-0 flex-1">
        <Link
          to={`/${lang}/sudska-praksa/${decisionId}`}
          className="block text-sm font-medium text-[color:var(--color-text)] hover:text-[color:var(--color-brand-navy)] truncate"
        >
          {title}
        </Link>
        {caseNum && (
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{caseNum}</p>
        )}
        {bookmark.created_at && (
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {t('library.addedOn')}:{' '}
            {new Date(bookmark.created_at).toLocaleDateString(lang === 'hr' ? 'hr-HR' : 'en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={t('library.removeBookmark')}
        className="shrink-0 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'bookmarks' | 'annotations'

export default function MyLibraryPage() {
  const { lang = 'hr' } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const [tab, setTab] = useState<Tab>('bookmarks')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch bookmarks ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getBookmarks()
      .then((bms) => {
        if (!cancelled) setBookmarks(bms)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          if (err.message.includes('401') || err.message.includes('403')) {
            setError('unauthenticated')
          } else {
            setError('load_error')
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  const handleBookmarkDeleted = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }

  // ── Unauthenticated state ────────────────────────────────────────────────

  if (error === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <BookmarkCheck className="mx-auto h-12 w-12 text-[color:var(--color-text-muted)] mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-[color:var(--color-heading)] mb-2">{t('library.title')}</h1>
        <p className="text-[color:var(--color-text-muted)] mb-6">
          {t('library.loginRequired')}
        </p>
        <Link
          to={`/${lang}/login`}
          className="inline-flex items-center gap-2 rounded-md bg-[color:var(--color-brand-navy)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-brand-navy-light)] transition-colors"
        >
          {t('library.login')}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  const grouped = groupByFolder(bookmarks, t('library.defaultFolder'))
  const folderKeys = Object.keys(grouped).sort()

  const TABS = [
    { id: 'bookmarks' as const, labelKey: 'library.tab.bookmarks', icon: BookmarkCheck },
    { id: 'annotations' as const, labelKey: 'library.tab.annotations', icon: StickyNote },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[color:var(--color-heading)]">{t('library.title')}</h1>
        <p className="mt-2 text-[color:var(--color-text-muted)]">
          {t('library.subtitle')}
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="mb-6 flex gap-1 border-b border-[color:var(--color-border)]"
        role="tablist"
        aria-label={t('library.tabsLabel')}
      >
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-[color:var(--color-brand-navy)] text-[color:var(--color-brand-navy)]'
                : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {t(labelKey)}
            {id === 'bookmarks' && bookmarks.length > 0 && (
              <span className="ml-1 rounded-full bg-[color:var(--color-surface-subtle)] px-2 py-0.5 text-xs">
                {bookmarks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bookmarks panel */}
      {tab === 'bookmarks' && (
        <div id="panel-bookmarks" role="tabpanel" aria-label={t('library.tab.bookmarks')}>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-20 animate-pulse rounded-lg bg-[color:var(--color-surface-subtle)]"
                />
              ))}
            </div>
          ) : error ? (
            <p className="text-[color:var(--color-error)]" role="alert">
              {t('library.loadError')}
            </p>
          ) : bookmarks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[color:var(--color-border)] py-16 text-center">
              <BookmarkCheck className="mx-auto h-10 w-10 text-[color:var(--color-text-muted)] mb-3" aria-hidden="true" />
              <p className="text-[color:var(--color-text-muted)]">
                {t('library.noBookmarks')}
              </p>
              <Link
                to={`/${lang}/sudska-praksa/pretraga`}
                className="mt-4 inline-flex items-center gap-1 text-sm text-[color:var(--color-brand-navy)] hover:underline"
              >
                {t('library.searchDecisions')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {folderKeys.map((folderName) => (
                <section key={folderName} aria-labelledby={`folder-${folderName}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-[color:var(--color-text-muted)]" aria-hidden="true" />
                    <h2
                      id={`folder-${folderName}`}
                      className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]"
                    >
                      {folderName}
                    </h2>
                    <span className="text-xs text-[color:var(--color-text-muted)]">
                      ({grouped[folderName].length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped[folderName].map((bm) => (
                      <BookmarkCard
                        key={bm.id}
                        bookmark={bm}
                        lang={lang}
                        onDelete={handleBookmarkDeleted}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Annotations panel */}
      {tab === 'annotations' && (
        <div id="panel-annotations" role="tabpanel" aria-label={t('library.tab.annotations')}>
          <div className="rounded-xl border-2 border-dashed border-[color:var(--color-border)] py-16 text-center">
            <StickyNote className="mx-auto h-10 w-10 text-[color:var(--color-text-muted)] mb-3" aria-hidden="true" />
            <p className="text-[color:var(--color-text-muted)]">
              {t('library.annotationsHint')}
            </p>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              {t('library.annotationsInstructions')}
            </p>
            <Link
              to={`/${lang}/sudska-praksa/pretraga`}
              className="mt-4 inline-flex items-center gap-1 text-sm text-[color:var(--color-brand-navy)] hover:underline"
            >
              {t('library.searchDecisions')}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
