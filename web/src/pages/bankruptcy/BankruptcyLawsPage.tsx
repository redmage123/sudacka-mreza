import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

type LawEntry = {
  title: string
  gazette: string
  amended?: string
  description: string
  href: string
  isEU?: boolean
}

const NATIONAL_LAWS: LawEntry[] = [
  {
    title: 'Stečajni zakon',
    gazette: 'NN 71/15, 104/17, 36/22',
    amended: '2022',
    description:
      'Temeljni propis koji uređuje stečajni postupak, uvjete za otvaranje stečaja, ovlasti stečajnog upravitelja i namirenje vjerovnika u Republici Hrvatskoj.',
    href: 'https://www.zakon.hr/z/160/Ste%C4%8Dajni-zakon',
  },
  {
    title: 'Zakon o financijskom poslovanju i predstečajnoj nagodbi',
    gazette: 'NN 108/12, 144/12, 81/13, 112/13, 71/15, 78/15',
    amended: '2015',
    description:
      'Uređuje financijsko poslovanje poduzetnika, mjere rane intervencije kod znakova nelikvidnosti te predstečajnu nagodbu kao alternativu stečaju.',
    href: 'https://www.zakon.hr/z/558/Zakon-o-financijskom-poslovanju-i-predste%C4%8Dajnoj-nagodbi',
  },
  {
    title: 'Zakon o osiguranju potraživanja radnika u slučaju stečaja poslodavca',
    gazette: 'NN 86/08, 80/13, 82/15',
    amended: '2015',
    description:
      'Osigurava isplatu plaća i naknada radnicima čiji je poslodavac otvorio stečaj. Agencija za osiguranje depozita i sanaciju banaka (HZZO) isplaćuje zaštićena potraživanja.',
    href: 'https://www.zakon.hr/z/398/Zakon-o-osiguranju-potra%C5%BEivanja-radnika-u-slu%C4%8Daju-ste%C4%8Daja-poslodavca',
  },
  {
    title: 'Stečajni zakon (prečišćeni tekst) — zakon.hr',
    gazette: 'NN 71/15 + izmjene',
    description: 'Prečišćeni pročišćeni tekst Stečajnog zakona na portalu zakon.hr (neformalni prijevod).',
    href: 'https://www.zakon.hr/z/160/Ste%C4%8Dajni-zakon',
  },
]

const EU_LAWS: LawEntry[] = [
  {
    title: 'Directive (EU) 2019/1023',
    gazette: 'OJ L 172, 26.6.2019',
    amended: '2019',
    description:
      'EU Directive on preventive restructuring frameworks, discharge of debt and disqualifications. Aims to give viable but insolvent businesses a second chance across the EU single market.',
    href: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L1023',
    isEU: true,
  },
  {
    title: 'Regulation (EU) 2015/848 on insolvency proceedings',
    gazette: 'OJ L 141, 5.6.2015',
    amended: '2015',
    description:
      'Governs cross-border insolvency proceedings within the EU, including jurisdiction, recognition of proceedings opened in other Member States, and coordination of main and secondary proceedings.',
    href: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32015R0848',
    isEU: true,
  },
]

function LawCard({ law }: { law: LawEntry }) {
  const { t } = useTranslation('common')
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-base font-semibold text-[color:var(--color-heading)]">{law.title}</h3>
        {law.isEU && (
          <span className="flex-shrink-0 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-2 py-0.5">
            EU
          </span>
        )}
      </div>
      <p className="text-xs text-[color:var(--color-text-muted)] mb-1">
        <span className="font-medium">{t('laws.officialGazette')}:</span> {law.gazette}
        {law.amended && (
          <span className="ml-3">
            <span className="font-medium">{t('laws.lastUpdated')}:</span> {law.amended}
          </span>
        )}
      </p>
      <p className="text-sm text-[color:var(--color-text)] leading-relaxed mb-3">{law.description}</p>
      <a
        href={law.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-brand)] hover:underline"
      >
        {t('laws.readFull')} ↗
      </a>
    </div>
  )
}

export default function BankruptcyLawsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('bankruptcyLaws')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('bankruptcyLaws') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('laws.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">{t('laws.subtitle')}</p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-4">
          {t('laws.national.title')}
        </h2>
        <div className="space-y-4">
          {NATIONAL_LAWS.map((law) => (
            <LawCard key={law.href} law={law} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-4">
          {t('laws.eu.title')}
        </h2>
        <div className="space-y-4">
          {EU_LAWS.map((law) => (
            <LawCard key={law.href} law={law} />
          ))}
        </div>
      </section>
    </div>
  )
}
