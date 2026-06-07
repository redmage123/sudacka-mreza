import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

type Exchange = {
  title: string
  origin?: string
  year?: string
  description: string
  href: string
}

// Mirrors http://www.sudacka-mreza.hr/sr.aspx?Type=2 — International Exchange.
const EXCHANGES: Exchange[] = [
  {
    title: 'EU Directive 2019/1023 — Preventive restructuring frameworks',
    origin: 'European Union',
    year: '2019',
    description:
      'EU Directive on preventive restructuring frameworks, discharge of debt and disqualifications. Reference text for Croatian implementation work.',
    href: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L1023',
  },
  {
    title: 'EU Regulation 2015/848 on insolvency proceedings',
    origin: 'European Union',
    year: '2015',
    description:
      'Cross-border insolvency proceedings within the EU — jurisdiction, recognition and coordination of main and secondary proceedings.',
    href: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32015R0848',
  },
  {
    title: 'UNCITRAL Model Law on Cross-Border Insolvency',
    origin: 'United Nations',
    year: '1997, amended 2013',
    description:
      'UNCITRAL Model Law providing a framework for recognising foreign insolvency proceedings and cooperation between courts in different jurisdictions.',
    href: 'https://uncitral.un.org/en/texts/insolvency/modellaw/cross-border_insolvency',
  },
  {
    title: 'INSOL Europe — Professional Practice and Reform',
    origin: 'INSOL Europe',
    description:
      'Association of European restructuring and insolvency professionals. Useful for comparative practice, conferences and policy work.',
    href: 'https://www.insol-europe.org/',
  },
  {
    title: 'World Bank — Principles for Effective Insolvency and Creditor Rights',
    origin: 'World Bank',
    description:
      'Internationally recognised principles for the design of insolvency and creditor-debtor regimes, used in country-level assessments.',
    href: 'https://www.worldbank.org/en/topic/financialsector/brief/the-world-bank-principles-for-effective-insolvency-and-creditor-rights',
  },
]

function ExchangeCard({ item }: { item: Exchange }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h3 className="text-base font-semibold text-[color:var(--color-heading)] mb-2">{item.title}</h3>
      {(item.origin || item.year) && (
        <p className="text-xs text-[color:var(--color-text-muted)] mb-2">
          {item.origin && <span>{item.origin}</span>}
          {item.origin && item.year && <span> · </span>}
          {item.year && <span>{item.year}</span>}
        </p>
      )}
      <p className="text-sm text-[color:var(--color-text)] leading-relaxed mb-3">{item.description}</p>
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-brand)] hover:underline"
      >
        Open source ↗
      </a>
    </div>
  )
}

export default function BankruptcyInternationalExchangePage() {
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('internationalExchange')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('internationalExchange') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {tn('internationalExchange')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">
        International materials on insolvency law and cross-border bankruptcy proceedings —
        EU directives, UNCITRAL model law, and international professional associations.
      </p>

      <div className="space-y-4">
        {EXCHANGES.map((it) => (
          <ExchangeCard key={it.href} item={it} />
        ))}
      </div>
    </div>
  )
}
