import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/api/client'
import { z } from 'zod'

const GallerySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  slug: z.string().optional(),
  coverImage: z.any().optional(),
  photoCount: z.number().optional(),
})
type Gallery = z.infer<typeof GallerySchema>

const ListSchema = z.object({
  docs: z.array(GallerySchema),
  totalDocs: z.number(),
})

export default function GalleriesPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('galleries')

  const [items, setItems] = useState<Gallery[]>([])
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
    apiFetch('/galleries', ListSchema, { params: { limit: 24, locale } })
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('galleries') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('galleries.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-8">{t('galleries.subtitle')}</p>

      {error && <Alert variant="error">{t('galleries.loadError')}</Alert>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-20 text-center">
          <div className="text-5xl mb-4">🖼️</div>
          <p className="text-[color:var(--color-text-muted)] text-lg">{t('galleries.noGalleries')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((g) => (
            <Link
              key={g.id}
              to={`/${locale}/galerije/${g.id}`}
              className="group rounded-xl overflow-hidden border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:shadow-md transition-all"
            >
              <div className="aspect-video bg-[color:var(--color-surface-alt)] flex items-center justify-center text-4xl">
                🖼️
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-[color:var(--color-heading)] group-hover:text-[color:var(--color-brand)] truncate">
                  {g.title ?? t('galleries.viewGallery')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
