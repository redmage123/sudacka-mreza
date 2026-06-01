import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function PressClippingPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home', 'Početna'), href: `/${locale}` },
          { label: t('media.press.title', 'Novinski članci') },
        ]}
        className="mb-6"
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-3">
        {t('media.press.title', 'Novinski članci')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] max-w-2xl">
        {t('media.press.placeholder', 'Press clipping — novinski članci i web portali u kojima se spominje Sudačka Mreža. Sadržaj će biti popunjen u sklopu migracije podataka sa stare stranice.')}
      </p>
    </div>
  )
}
