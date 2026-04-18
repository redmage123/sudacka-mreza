import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function TermsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('terms')

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('terms.title', 'Terms of Service') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('terms.title', 'Terms of Service')}
      </h1>
      <div className="prose dark:prose-invert max-w-none space-y-6 text-[color:var(--color-text)]">
        <section>
          <h2 className="text-xl font-semibold">{t('terms.service.title', 'Service Description')}</h2>
          <p>{t('terms.service.body', 'Sudačka Mreža is a public information platform providing access to Croatian court data, judicial decisions, legal resources, and court administration tools. The service is provided free of charge for informational purposes.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.accounts.title', 'User Accounts')}</h2>
          <p>{t('terms.accounts.body', 'Registration is optional. Registered users may access additional features such as document saving, watchlists, and personalized settings. You are responsible for maintaining the confidentiality of your account credentials.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.acceptable.title', 'Acceptable Use')}</h2>
          <p>{t('terms.acceptable.body', 'You may use this service for lawful purposes only. Automated scraping, bulk data extraction, or any activity that disrupts the service is prohibited.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.ip.title', 'Intellectual Property')}</h2>
          <p>{t('terms.ip.body', 'Court decisions and public legal data are in the public domain. The platform design, code, and original content are protected by copyright. The Sudačka Mreža name and logo are trademarks.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.disclaimer.title', 'Disclaimer')}</h2>
          <p>{t('terms.disclaimer.body', 'Information on this platform is provided for informational purposes only and does not constitute legal advice. While we strive for accuracy, we make no warranties regarding the completeness or currency of the data. Consult a qualified legal professional for advice on specific legal matters.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.liability.title', 'Limitation of Liability')}</h2>
          <p>{t('terms.liability.body', 'Sudačka Mreža shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of this service or reliance on information provided herein.')}</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t('terms.law.title', 'Governing Law')}</h2>
          <p>{t('terms.law.body', 'These terms are governed by the laws of the Republic of Croatia. Any disputes shall be resolved by the competent courts in Zagreb, Croatia.')}</p>
        </section>
      </div>
    </div>
  )
}
