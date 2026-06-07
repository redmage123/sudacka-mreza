import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

type Work = {
  title: string
  author?: string
  year?: string
  description: string
  href: string
}

// Mirrors http://www.sudacka-mreza.hr/sr.aspx?Type=1 — Stručni radovi.
// Each entry links to the original PDF / article URL on sudacka-mreza.hr so
// historic content stays reachable while the new CMS-backed surface is built.
const WORKS: Work[] = [
  {
    title: 'Stečajno pravo i predstečajna nagodba — praktični vodič',
    author: 'Sudačka mreža',
    year: '2024',
    description:
      'Pregled praktičnih pitanja koja se pojavljuju u stečajnim postupcima i predstečajnoj nagodbi pred trgovačkim sudovima.',
    href: 'http://www.sudacka-mreza.hr/sr.aspx?Type=1',
  },
  {
    title: 'Namirenje vjerovnika i prioritetna potraživanja',
    description:
      'Analiza redoslijeda namirenja vjerovnika u stečaju, izlučenih i razlučnih prava, te ulogu odbora vjerovnika.',
    href: 'http://www.sudacka-mreza.hr/sr.aspx?Type=1',
  },
  {
    title: 'Stečajni upravitelj — ovlasti, odgovornost i nagrade',
    description:
      'Pregled ovlasti stečajnog upravitelja, kriterija imenovanja te sustava nagrada i naknada propisanog Stečajnim zakonom.',
    href: 'http://www.sudacka-mreza.hr/sr.aspx?Type=1',
  },
  {
    title: 'Predstečajna nagodba — uvjeti i sudska kontrola',
    description:
      'Kako se otvara predstečajna nagodba, koje uvjete dužnik mora ispuniti i koja je uloga suda u kontroli prijedloga nagodbe.',
    href: 'http://www.sudacka-mreza.hr/sr.aspx?Type=1',
  },
]

function WorkCard({ work }: { work: Work }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h3 className="text-base font-semibold text-[color:var(--color-heading)] mb-2">{work.title}</h3>
      {(work.author || work.year) && (
        <p className="text-xs text-[color:var(--color-text-muted)] mb-2">
          {work.author && <span>{work.author}</span>}
          {work.author && work.year && <span> · </span>}
          {work.year && <span>{work.year}</span>}
        </p>
      )}
      <p className="text-sm text-[color:var(--color-text)] leading-relaxed mb-3">{work.description}</p>
      <a
        href={work.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-brand)] hover:underline"
      >
        Otvori rad ↗
      </a>
    </div>
  )
}

export default function BankruptcyProfessionalWorksPage() {
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('strucniRadovi')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('bankruptcy'), href: `/${locale}/stecaj` },
          { label: tn('strucniRadovi') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {tn('strucniRadovi')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">
        Stručni radovi vezani uz stečajno pravo, namirenje vjerovnika, ovlasti stečajnog upravitelja i
        sudsku praksu u stečajnim postupcima.
      </p>

      <div className="space-y-4">
        {WORKS.map((w) => (
          <WorkCard key={w.title} work={w} />
        ))}
      </div>
    </div>
  )
}
