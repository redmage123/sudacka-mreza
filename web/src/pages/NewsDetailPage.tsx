import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { TextToSpeech } from '@/components/TextToSpeech'

interface NewsArticle {
  id?: string | number
  title?: string
  slug?: string
  excerpt?: string
  body?: string
  content?: string
  text?: string
  publishedAt?: string
  date?: string
}

export default function NewsDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, slug } = useParams<{ lang: string; slug: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('newsDetail')
  const [article, setArticle] = useState<NewsArticle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    // Payload list-by-slug: ?where[slug][equals]=<slug>&limit=1
    const qs = new URLSearchParams({
      'where[slug][equals]': slug,
      limit: '1',
      locale,
    })
    fetch(`/api/news-posts?${qs.toString()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const doc = d?.docs?.[0] ?? null
        setArticle(doc)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug, locale])

  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse h-64 bg-[color:var(--color-surface-subtle)] rounded" />
      </div>
    )
  if (!article)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-[color:var(--color-text-muted)]">{t('news.notFound', 'Article not found')}</p>
      </div>
    )

  const body = article.body || article.content || article.text || ''
  const date = article.publishedAt || article.date

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: tn('news'), href: `/${locale}/novosti` },
        { label: article.title?.substring(0, 40) || '' },
      ]} />
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-2">{article.title}</h1>
      {date && <p className="text-sm text-[color:var(--color-text-muted)] mb-4">{date.split('T')[0]}</p>}
      {body && <TextToSpeech text={body.substring(0, 5000)} className="mb-4" />}
      <div className="prose dark:prose-invert max-w-none"><div className="whitespace-pre-wrap">{body}</div></div>
    </div>
  )
}
