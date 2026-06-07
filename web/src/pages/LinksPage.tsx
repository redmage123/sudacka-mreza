import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { usePageTitle } from '@/hooks/usePageTitle'

// Mirrors http://www.sudacka-mreza.hr/linkovi.aspx — a curated list of
// useful Croatian and EU legal resources for judges, attorneys and
// citizens. Grouped so visitors can scan quickly.
type LinkGroup = { heading: string; links: { title: string; href: string; description?: string }[] }

const GROUPS: LinkGroup[] = [
  {
    heading: 'Sudovi i pravosuđe',
    links: [
      { title: 'Vrhovni sud Republike Hrvatske', href: 'https://www.vsrh.hr/', description: 'Najviši sud u RH — sudska praksa, odluke i obavijesti.' },
      { title: 'Visoki upravni sud RH', href: 'https://www.vusrh.hr/', description: 'Drugostupanjski sud u upravnim sporovima.' },
      { title: 'Visoki trgovački sud RH', href: 'https://vtsrh.pravosudje.hr/', description: 'Drugostupanjski sud u trgovačkim sporovima.' },
      { title: 'Visoki kazneni sud RH', href: 'https://www.vksrh.hr/', description: 'Drugostupanjski sud u kaznenim postupcima.' },
      { title: 'Ministarstvo pravosuđa i uprave', href: 'https://mpu.gov.hr/' },
      { title: 'Pravosudna akademija', href: 'https://pak.hr/' },
    ],
  },
  {
    heading: 'Državna tijela',
    links: [
      { title: 'Državno odvjetništvo RH', href: 'https://dorh.hr/' },
      { title: 'Vrhovno državno odvjetništvo', href: 'https://dorh.hr/' },
      { title: 'USKOK', href: 'https://dorh.hr/uskok' },
      { title: 'Pučki pravobranitelj', href: 'https://www.ombudsman.hr/' },
      { title: 'Hrvatski sabor', href: 'https://www.sabor.hr/' },
    ],
  },
  {
    heading: 'Zakonodavstvo i registri',
    links: [
      { title: 'Narodne novine — službeni list RH', href: 'https://narodne-novine.nn.hr/' },
      { title: 'zakon.hr — neslužbeni pročišćeni tekstovi', href: 'https://www.zakon.hr/' },
      { title: 'EUR-Lex — pravni akti EU', href: 'https://eur-lex.europa.eu/homepage.html?locale=hr' },
      { title: 'Sudski registar (RPS)', href: 'https://sudreg.pravosudje.hr/' },
      { title: 'Zemljišne knjige', href: 'https://zk.pravosudje.hr/' },
    ],
  },
  {
    heading: 'Profesionalna udruženja',
    links: [
      { title: 'Hrvatska odvjetnička komora', href: 'https://www.hok-cba.hr/' },
      { title: 'Hrvatska javnobilježnička komora', href: 'https://www.hjk.hr/' },
      { title: 'Hrvatska gospodarska komora — stečajni upravitelji', href: 'https://www.hgk.hr/' },
      { title: 'Udruga hrvatskih sudaca', href: 'https://uhs.hr/' },
    ],
  },
  {
    heading: 'EU i međunarodni',
    links: [
      { title: 'Europski sud za ljudska prava (ESLJP)', href: 'https://www.echr.coe.int/' },
      { title: 'Sud Europske unije', href: 'https://curia.europa.eu/' },
      { title: 'Europska pravosudna mreža (EJN)', href: 'https://www.ejn-crimjust.europa.eu/' },
      { title: 'CEPEJ — Vijeće Europe', href: 'https://www.coe.int/en/web/cepej' },
    ],
  },
]

export default function LinksPage() {
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('links')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('links') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {tn('links')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">
        Korisni linkovi na hrvatske i europske pravosudne resurse — sudovi, državna tijela, registri,
        profesionalna udruženja i EU institucije.
      </p>

      <div className="space-y-10">
        {GROUPS.map((g) => (
          <section key={g.heading}>
            <h2 className="text-xl font-semibold text-[color:var(--color-heading)] mb-4 border-b border-[color:var(--color-border)] pb-2">
              {g.heading}
            </h2>
            <ul className="space-y-3">
              {g.links.map((l) => (
                <li key={l.href} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    {l.title} ↗
                  </a>
                  {l.description && (
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1">{l.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
