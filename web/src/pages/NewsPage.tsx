import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const NewsItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  publishedAt: z.string().optional(),
  coverImage: z.any().optional(),
})
type NewsItem = z.infer<typeof NewsItemSchema>

const ListSchema = z.object({
  docs: z.array(NewsItemSchema),
  totalDocs: z.number(),
  totalPages: z.number().optional(),
  page: z.number().optional(),
})

const PAGE_SIZE = 12

export default function NewsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('news')

  const [items, setItems] = useState<NewsItem[]>([])
  const [, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('/news-posts', ListSchema, { params: { limit: PAGE_SIZE, page, locale, sort: '-publishedAt' } })
      .then((d) => {
        if (!mounted.current) return
        setItems(d.docs)
        setTotalDocs(d.totalDocs)
        setTotalPages(d.totalPages ?? 1)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        setError(true)
        setLoading(false)
      })
  }, [page, locale])

  function formatDate(iso?: string) {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('news') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('news.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-8">{t('news.subtitle')}</p>

      {error && <Alert variant="error">{t('news.loadError')}</Alert>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[color:var(--color-border)] overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-20 text-center">
          <div className="text-5xl mb-4">📰</div>
          <p className="text-[color:var(--color-text-muted)] text-lg">{t('news.noNews')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/${locale}/vijesti/${item.slug ?? item.id}`}
                className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden hover:shadow-md transition-all"
              >
                <div className="aspect-video bg-[color:var(--color-surface-alt)] flex items-center justify-center text-4xl">
                  📰
                </div>
                <div className="p-4">
                  {item.publishedAt && (
                    <p className="text-xs text-[color:var(--color-text-muted)] mb-1">
                      {t('news.publishedOn')}: {formatDate(item.publishedAt)}
                    </p>
                  )}
                  <h2 className="text-base font-semibold text-[color:var(--color-heading)] group-hover:text-[color:var(--color-brand)] mb-2 line-clamp-2">
                    {item.title ?? '—'}
                  </h2>
                  {item.excerpt && (
                    <p className="text-sm text-[color:var(--color-text-muted)] line-clamp-3 mb-3">
                      {item.excerpt}
                    </p>
                  )}
                  <span className="text-sm font-medium text-[color:var(--color-brand)]">
                    {t('news.readMore')} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}
