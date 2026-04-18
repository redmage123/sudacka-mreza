import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function PrivacyPolicyPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('privacyPolicy')

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('privacy.title', 'Privacy Policy') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('privacy.title', 'Privacy Policy')}
      </h1>
      <div className="prose dark:prose-invert max-w-none space-y-6 text-[color:var(--color-text)]">
        <p className="text-[color:var(--color-text-muted)]">{t('privacy.lastUpdated', 'Last updated: March 2026')}</p>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.dataCollected.title', 'Data We Collect')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('privacy.dataCollected.contact', 'Contact form submissions: name, email, subject, message')}</li>
            <li>{t('privacy.dataCollected.registration', 'Registration: name, email, password (hashed)')}</li>
            <li>{t('privacy.dataCollected.cookies', 'Cookies: essential session cookies, optional analytics cookies (with your consent)')}</li>
            <li>{t('privacy.dataCollected.usage', 'Usage data: pages visited, time on site (anonymized, only with analytics consent)')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.lawfulBasis.title', 'Lawful Basis for Processing')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('privacy.lawfulBasis.consent', 'Consent: analytics cookies, newsletter subscription')}</li>
            <li>{t('privacy.lawfulBasis.contract', 'Contract performance: user account management')}</li>
            <li>{t('privacy.lawfulBasis.legitimate', 'Legitimate interest: security monitoring, service improvement')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.retention.title', 'Data Retention')}</h2>
          <p>{t('privacy.retention.body', 'Contact form data is retained for 2 years. User accounts are retained for the duration of the account. Analytics data is anonymized and aggregated after 26 months. You may request deletion at any time.')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.rights.title', 'Your Rights')}</h2>
          <p>{t('privacy.rights.intro', 'Under GDPR, you have the right to:')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('privacy.rights.access', 'Access your personal data')}</li>
            <li>{t('privacy.rights.rectification', 'Rectify inaccurate data')}</li>
            <li>{t('privacy.rights.erasure', 'Request erasure of your data')}</li>
            <li>{t('privacy.rights.portability', 'Data portability')}</li>
            <li>{t('privacy.rights.objection', 'Object to processing')}</li>
            <li>{t('privacy.rights.withdraw', 'Withdraw consent at any time')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.thirdParty.title', 'Third-Party Services')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('privacy.thirdParty.maps', 'OpenStreetMap / CartoDB: map tiles (IP address transmitted)')}</li>
            <li>{t('privacy.thirdParty.hosting', 'Hetzner Online GmbH: hosting provider (Germany, EU)')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.authority.title', 'Supervisory Authority')}</h2>
          <p>{t('privacy.authority.body', 'You have the right to lodge a complaint with the Croatian Personal Data Protection Agency (AZOP):')}</p>
          <p className="font-medium">Agencija za zaštitu osobnih podataka (AZOP)<br />
            Fra Grge Martića 14, 10000 Zagreb<br />
            azop.hr | +385 1 4609 000</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">{t('privacy.contact.title', 'Contact')}</h2>
          <p>{t('privacy.contact.body', 'For privacy-related inquiries, contact us via the contact page or email: info@sudacka-mreza.hr')}</p>
        </section>
      </div>
    </div>
  )
}
