import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function CookiePolicyPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('cookiePolicy')

  const cookies = [
    { name: 'sudacka-consent', purpose: t('cookiePolicy.cookies.consent', 'Stores your cookie consent preferences'), category: t('cookiePolicy.essential', 'Essential'), retention: '12 months', party: t('cookiePolicy.firstParty', 'First-party') },
    { name: 'sudacka-dark-mode', purpose: t('cookiePolicy.cookies.darkMode', 'Stores your dark/light mode preference'), category: t('cookiePolicy.essential', 'Essential'), retention: t('cookiePolicy.noExpiry', 'No expiry'), party: t('cookiePolicy.firstParty', 'First-party') },
    { name: 'sudacka-watchlist', purpose: t('cookiePolicy.cookies.watchlist', 'Stores your court/judge watchlist'), category: t('cookiePolicy.essential', 'Essential'), retention: t('cookiePolicy.noExpiry', 'No expiry'), party: t('cookiePolicy.firstParty', 'First-party') },
    { name: 'i18nextLng', purpose: t('cookiePolicy.cookies.language', 'Stores your language preference'), category: t('cookiePolicy.preference', 'Preference'), retention: t('cookiePolicy.noExpiry', 'No expiry'), party: t('cookiePolicy.firstParty', 'First-party') },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('cookiePolicy.title', 'Cookie Policy') }]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('cookiePolicy.title', 'Cookie Policy')}
      </h1>
      <div className="space-y-6 text-[color:var(--color-text)]">
        <p>{t('cookiePolicy.intro', 'This site uses cookies and localStorage to provide essential functionality. We do not use tracking or advertising cookies.')}</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="text-left py-2 pr-4 font-semibold">{t('cookiePolicy.name', 'Name')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{t('cookiePolicy.purposeHeader', 'Purpose')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{t('cookiePolicy.categoryHeader', 'Category')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{t('cookiePolicy.retentionHeader', 'Retention')}</th>
                <th className="text-left py-2 font-semibold">{t('cookiePolicy.partyHeader', 'Party')}</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map(c => (
                <tr key={c.name} className="border-b border-[color:var(--color-border)]">
                  <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                  <td className="py-2 pr-4">{c.purpose}</td>
                  <td className="py-2 pr-4">{c.category}</td>
                  <td className="py-2 pr-4">{c.retention}</td>
                  <td className="py-2">{c.party}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>{t('cookiePolicy.manage', 'You can manage your cookie preferences at any time using the "Cookie Settings" link in the footer.')}</p>
      </div>
    </div>
  )
}
