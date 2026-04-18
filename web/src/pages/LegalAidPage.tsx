import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

const COUNTY_OFFICES = [
  'Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar',
  'Varaždin', 'Dubrovnik', 'Bjelovar', 'Gospić', 'Karlovac',
  'Koprivnica', 'Krapina', 'Požega', 'Sisak', 'Slavonski Brod',
  'Virovitica', 'Vukovar', 'Šibenik', 'Čakovec',
]

export default function LegalAidPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('legalAid')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('legalAid') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-4 mt-6">
        {t('legalAid.title')}
      </h1>
      <p className="text-[color:var(--color-text)] leading-relaxed max-w-3xl mb-10">
        {t('legalAid.intro')}
      </p>

      {/* Primary & Secondary */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-12">
        {(['primary', 'secondary'] as const).map((type) => (
          <div
            key={type}
            className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          >
            <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-2">
              {t(`legalAid.${type}.title`)}
            </h2>
            <p className="text-sm text-[color:var(--color-text)] leading-relaxed">
              {t(`legalAid.${type}.desc`)}
            </p>
          </div>
        ))}
      </div>

      {/* Eligibility */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-3">
          {t('legalAid.eligibility.title')}
        </h2>
        <p className="text-[color:var(--color-text)] leading-relaxed max-w-3xl">
          {t('legalAid.eligibility.income')}
        </p>
      </section>

      {/* How to apply */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-4">
          {t('legalAid.howToApply.title')}
        </h2>
        <ol className="space-y-3 max-w-2xl">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex gap-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-4"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-brand)] text-white text-sm font-bold">
                {i}
              </span>
              <span className="text-[color:var(--color-text)] leading-snug pt-1">
                {t(`legalAid.howToApply.step${i}`).replace(/^\d+\.\s*/, '')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* County offices */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-2">
          {t('legalAid.offices.title')}
        </h2>
        <p className="text-sm text-[color:var(--color-text-muted)] mb-4">
          {t('legalAid.offices.contactHint')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {COUNTY_OFFICES.map((county) => (
            <div
              key={county}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text)]"
            >
              {county}
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-[color:var(--color-text-muted)]">
        {t('legalAid.officialSource')}
      </p>
    </div>
  )
}
