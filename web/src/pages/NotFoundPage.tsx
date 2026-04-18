import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl font-bold text-[color:var(--color-brand-gold)] mb-4">404</p>
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-4">{t('notFound.title', 'Page not found')}</h1>
      <p className="text-[color:var(--color-text-muted)] mb-8">{t('notFound.description', 'The page you are looking for does not exist or has been moved.')}</p>
      <Link to={`/${locale}`} className="inline-block rounded-md bg-[color:var(--color-brand-navy)] text-white px-6 py-2.5 font-medium hover:opacity-90">{t('notFound.goHome', 'Go to homepage')}</Link>
    </div>
  )
}
