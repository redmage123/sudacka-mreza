import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function GalleryDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('galleryDetail')
  const [gallery, setGallery] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/galleries/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setGallery(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8"><div className="animate-pulse h-64 bg-[color:var(--color-surface-subtle)] rounded" /></div>
  if (!gallery) return <div className="mx-auto max-w-5xl px-4 py-8 text-center"><p className="text-[color:var(--color-text-muted)]">{t('galleries.notFound', 'Gallery not found')}</p></div>

  const images = gallery.images || gallery.media || []

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('galleries.title', 'Galleries'), href: `/${locale}/galerije` }, { label: gallery.title || '' }]} />
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-6">{gallery.title}</h1>
      {gallery.description && <p className="text-[color:var(--color-text-muted)] mb-6">{gallery.description}</p>}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img: any, i: number) => (
            <div key={i} className="aspect-square overflow-hidden rounded-lg bg-[color:var(--color-surface)]">
              <img src={img.url || img.src || img} alt={img.alt || gallery.title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center py-8 text-[color:var(--color-text-muted)]">{t('galleries.noImages', 'No images in this gallery')}</p>
      )}
    </div>
  )
}
