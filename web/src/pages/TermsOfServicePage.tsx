import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function TermsOfServicePage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('terms.title')

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: t('terms.title') },
        ]}
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold-light)] mt-6 mb-2">
        {t('terms.title')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] mb-10">{t('terms.lastUpdated')}</p>

      <div className="prose prose-lg max-w-none text-[color:var(--color-text)] space-y-8">
        <p>{t('terms.intro')}</p>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section1.title')}</h2>
          <p>{t('terms.section1.p1')}</p>
          <p>{t('terms.section1.p2')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section2.title')}</h2>
          <p>{t('terms.section2.p1')}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t('terms.section2.li1')}</li>
            <li>{t('terms.section2.li2')}</li>
            <li>{t('terms.section2.li3')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section3.title')}</h2>
          <p>{t('terms.section3.p1')}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t('terms.section3.li1')}</li>
            <li>{t('terms.section3.li2')}</li>
            <li>{t('terms.section3.li3')}</li>
            <li>{t('terms.section3.li4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section4.title')}</h2>
          <p>{t('terms.section4.p1')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section5.title')}</h2>
          <p>{t('terms.section5.p1')}</p>
          <p>{t('terms.section5.p2')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section6.title')}</h2>
          <p>{t('terms.section6.p1')}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">{t('terms.section7.title')}</h2>
          <p>{t('terms.section7.p1')}</p>
          <p className="mt-2">
            {t('terms.section7.p2')}{' '}
            <Link to={`/${locale}/kontakt`} className="text-[color:var(--color-text-link)] hover:underline">
              {tn('contact')}
            </Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
