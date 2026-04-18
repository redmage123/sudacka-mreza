import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
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
})

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Press-kit / logo guidelines card — shown when no CMS items
function PressKitInfo({ t }: { t: (key: string) => string }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-8">
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="text-4xl mb-3">🖼️</div>
        <h3 className="font-semibold text-[color:var(--color-heading)] mb-2">{t('media.logos.title')}</h3>
        <p className="text-sm text-[color:var(--color-text-muted)]">{t('media.logos.desc')}</p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="text-4xl mb-3">📰</div>
        <h3 className="font-semibold text-[color:var(--color-heading)] mb-2">{t('media.press.title')}</h3>
        <p className="text-sm text-[color:var(--color-text-muted)]">{t('media.press.desc')}</p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="text-4xl mb-3">📬</div>
        <h3 className="font-semibold text-[color:var(--color-heading)] mb-2">{t('media.contact.title')}</h3>
        <p className="text-sm text-[color:var(--color-text-muted)]">{t('media.contact.desc')}</p>
        <a
          href="mailto:press@sudacka-mreza.hr"
          className="inline-block mt-3 text-sm font-medium text-[color:var(--color-primary)] hover:underline"
        >
          press@sudacka-mreza.hr
        </a>
      </div>
    </div>
  )
}

export default function MediaPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('media')

  const [items, setItems] = useState<Document[]>([])
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
    apiFetch('/documents', ListSchema, {
      params: {
        limit: 50,
        'where[category][in]': 'media,press,mediji',
        'where[lang][equals]': locale,
      },
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('media') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('media.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-8">{t('media.subtitle')}</p>

      {error && <Alert variant="error">{t('media.loadError')}</Alert>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <>
          <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-12 text-center">
            <div className="text-5xl mb-4">📰</div>
            <p className="text-[color:var(--color-text-muted)] text-lg">{t('media.noMedia')}</p>
            <p className="text-sm text-[color:var(--color-text-muted)] mt-2">{t('media.noMediaHint')}</p>
          </div>
          <PressKitInfo t={t} />
        </>
      ) : (
        <div className="space-y-3">
          {items.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 hover:border-[color:var(--color-brand)] transition-colors"
            >
              <span className="text-3xl flex-shrink-0 mt-0.5">📰</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[color:var(--color-heading)] truncate">{doc.title}</p>
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
      )}
    </div>
  )
}
