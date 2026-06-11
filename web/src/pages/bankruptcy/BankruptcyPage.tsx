import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BankruptcyAdvancedSearch } from '@/components/bankruptcy/BankruptcyAdvancedSearch'

export default function BankruptcyPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcy')

  const sections = [
    { key: 'listings', href: `/${locale}/stecaj/oglasi`, icon: '📋' },
    { key: 'debtors', href: `/${locale}/stecaj/duznici`, icon: '🏢' },
    { key: 'administrators', href: `/${locale}/stecaj/upravitelji`, icon: '👤' },
    { key: 'legislation', href: `/${locale}/stecaj/zakoni`, icon: '📖' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('bankruptcy.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">{t('bankruptcy.subtitle')}</p>

      <section className="mb-10">
        <h2 className="sr-only">{t('bankruptcy.search.title', 'Pretraga stečajnih predmeta')}</h2>
        <BankruptcyAdvancedSearch mode="navigate" />
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
        {sections.map((s) => (
          <Link
            key={s.key}
            to={s.href}
            className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 hover:border-[color:var(--color-brand)] hover:shadow-md transition-all"
          >
            <div className="text-4xl mb-3">{s.icon}</div>
            <h2 className="text-lg font-semibold text-[color:var(--color-heading)] group-hover:text-[color:var(--color-brand)] mb-1">
              {t(`bankruptcy.sections.${s.key}`)}
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {t(`bankruptcy.sections.${s.key}Desc`)}
            </p>
          </Link>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-3">
          {t('bankruptcy.overview.title')}
        </h2>
        <p className="text-[color:var(--color-text)] leading-relaxed max-w-3xl">
          {t('bankruptcy.overview.text')}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-4">
          {t('bankruptcy.process.title')}
        </h2>
        <ol className="space-y-3 max-w-2xl">
          {[1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="flex gap-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-4"
            >
              <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-brand)] text-white text-sm font-bold">
                {i}
              </span>
              <span className="text-[color:var(--color-text)] leading-snug pt-1">
                {t(`bankruptcy.process.step${i}`).replace(/^\d+\.\s*/, '')}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
