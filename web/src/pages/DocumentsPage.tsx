import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const DocumentFileSchema = z.object({
  url: z.string().optional(),
  filename: z.string().optional(),
  filesize: z.number().optional(),
  mimeType: z.string().optional(),
}).passthrough()

const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  publishedAt: z.string().optional(),
  file: DocumentFileSchema.optional(),
  lang: z.string().optional(),
}).passthrough()

type Document = z.infer<typeof DocumentSchema>

const ListSchema = z.object({
  docs: z.array(DocumentSchema),
  totalDocs: z.number(),
  totalPages: z.number().optional(),
})

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function categoryIcon(cat?: string): string {
  const c = (cat ?? '').toLowerCase()
  if (c.includes('form') || c.includes('obrazac')) return '📝'
  if (c.includes('tarif') || c.includes('fee')) return '💰'
  if (c.includes('pravil') || c.includes('rule') || c.includes('law')) return '⚖️'
  if (c.includes('vodič') || c.includes('guide') || c.includes('manual')) return '📖'
  return '📄'
}

export default function DocumentsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('documents')

  const [items, setItems] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('/documents', ListSchema, {
      params: { limit: 100, 'where[lang][equals]': locale },
    })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [locale])

  const categories = Array.from(new Set(items.map((d) => d.category ?? '').filter(Boolean)))
  const filtered = activeCategory === 'all'
    ? items
    : items.filter((d) => d.category === activeCategory)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('documents') },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2">
            {t('documents.title')}
          </h1>
          <p className="text-[color:var(--color-text-muted)]">{t('documents.subtitle')}</p>
        </div>
        <Link
          to={`/${locale}/dokumenti/generator`}
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-brand-navy)] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          ✍️ {t('docgen.title')}
        </Link>
      </div>

      {error && <Alert variant="error">{t('documents.loadError')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-20 text-center">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-[color:var(--color-text-muted)] text-lg">{t('documents.noDocuments')}</p>
        </div>
      ) : (
        <>
          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveCategory('all')}
                className={[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  activeCategory === 'all'
                    ? 'bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
                ].join(' ')}
              >
                {t('documents.filterAll')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    'px-3 py-1.5 text-sm rounded-full border transition-colors capitalize',
                    activeCategory === cat
                      ? 'bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]'
                      : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]',
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Document list */}
          <div className="space-y-3">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 hover:border-[color:var(--color-brand)] transition-colors"
              >
                <span className="text-3xl flex-shrink-0 mt-0.5">
                  {categoryIcon(doc.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[color:var(--color-heading)] truncate">{doc.title}</p>
                  {doc.category && (
                    <span className="inline-block text-xs rounded-full bg-[color:var(--color-surface-alt)] text-[color:var(--color-text-muted)] px-2 py-0.5 mt-1">
                      {doc.category}
                    </span>
                  )}
                  {doc.description && (
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1 line-clamp-2">{doc.description}</p>
                  )}
                  {doc.publishedAt && (
                    <p className="text-xs text-[color:var(--color-text-muted)] mt-1">
                      {t('documents.publishedOn')}: {new Date(doc.publishedAt).toLocaleDateString(locale)}
                    </p>
                  )}
                </div>
                {doc.file?.url && (
                  <a
                    href={doc.file.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    ↓ {t('download')}
                    {doc.file.filesize && (
                      <span className="opacity-70 text-xs">
                        {formatFileSize(doc.file.filesize)}
                      </span>
                    )}
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
