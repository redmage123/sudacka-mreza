import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function MembersPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('members')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('members.title', 'Members') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">{t('members.title', 'Members')}</h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">{t('members.description', 'The Sudačka Mreža professional network. Membership is open to judges, state attorneys, and legal professionals in Croatia.')}</p>
      <div className="text-center py-12 bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] rounded-lg">
        <p className="text-lg font-medium text-[color:var(--color-text-muted)]">{t('members.registrationRequired', 'Member directory is available to registered users')}</p>
        <p className="text-sm text-[color:var(--color-text-muted)] mt-2">{t('members.loginPrompt', 'Please log in or register to view the member directory.')}</p>
      </div>
    </div>
  )
}
