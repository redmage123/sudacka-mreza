import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

interface LegalNewsItem {
  id: string
  title: string
  source: 'IUS-INFO' | 'Novi Informator' | 'Narodne Novine'
  date: string
  excerpt: string
  url: string
}

const MOCK_NEWS: LegalNewsItem[] = [
  {
    id: '1',
    title: 'Izmjene Zakona o parničnom postupku – novi rokovi za odgovor na tužbu',
    source: 'IUS-INFO',
    date: '2026-03-25',
    excerpt: 'Vlada RH uputila je u proceduru izmjene ZPP-a koje predviđaju skraćivanje roka za odgovor na tužbu s 30 na 15 dana u sporovima male vrijednosti.',
    url: 'https://www.iusinfo.hr',
  },
  {
    id: '2',
    title: 'Objavljene izmjene Kaznenog zakona u pogledu kibernetičkih delikata',
    source: 'Narodne Novine',
    date: '2026-03-22',
    excerpt: 'U Narodnim novinama br. 38/2026 objavljene su izmjene Kaznenog zakona kojima se proširuje kaznena odgovornost za kibernetičke delikte i uvode strože kazne.',
    url: 'https://www.nn.hr',
  },
  {
    id: '3',
    title: 'Vrhovni sud donio načelni pravni stav o odgovornosti za štetu',
    source: 'IUS-INFO',
    date: '2026-03-20',
    excerpt: 'Vrhovni sud RH donio je načelni pravni stav kojim se usklađuje sudska praksa u predmetima izvanugovorne odgovornosti za štetu nastalu radom autonomnih sustava.',
    url: 'https://www.iusinfo.hr',
  },
  {
    id: '4',
    title: 'Novi Informator: Pregled stečajne prakse za Q1 2026.',
    source: 'Novi Informator',
    date: '2026-03-18',
    excerpt: 'Tromjesečni pregled stečajnih odluka trgovačkih sudova za Q1 2026. otkriva povećanje broja predstečajnih nagodbi za 18% u odnosu na prethodnu godinu.',
    url: 'https://www.novi-informator.net',
  },
  {
    id: '5',
    title: 'USKOK pokrenuo istragu u predmetu korupcije u pravosuđu',
    source: 'IUS-INFO',
    date: '2026-03-15',
    excerpt: 'Ured za suzbijanje korupcije i organiziranog kriminaliteta objavio je pokretanje istrage u predmetu korupcije koji uključuje dvojicu sudaca i odvjetnika.',
    url: 'https://www.iusinfo.hr',
  },
  {
    id: '6',
    title: 'Uredba EU o vještačenju stupila na snagu – obveze za sudske vještake',
    source: 'Novi Informator',
    date: '2026-03-12',
    excerpt: 'Nova uredba EU 2026/445 o standardima vještačenja u sudskim postupcima stupila je na snagu i obvezuje sve države članice na usklađivanje unutarnjeg prava.',
    url: 'https://www.novi-informator.net',
  },
  {
    id: '7',
    title: 'Pravilnik o nagradi i naknadi troškova odvjetnika – izmjene 2026.',
    source: 'Narodne Novine',
    date: '2026-03-10',
    excerpt: 'Objavljen je novi Pravilnik o nagradi i naknadi troškova odvjetnika kojim se tarife usklađuju s rastom inflacije, s primjenom od 1. travnja 2026.',
    url: 'https://www.nn.hr',
  },
  {
    id: '8',
    title: 'ESLJP presudio protiv RH u predmetu dugotrajnog postupka',
    source: 'IUS-INFO',
    date: '2026-03-08',
    excerpt: 'ESLJP je u predmetu Horvat protiv Hrvatske presudio da Republika Hrvatska nije ispunila obvezu suđenja u razumnom roku te dosudio pravičnu naknadu podnositelju.',
    url: 'https://www.iusinfo.hr',
  },
  {
    id: '9',
    title: 'Izmjene Ovršnog zakona – digitalizacija postupka ovrhe',
    source: 'Novi Informator',
    date: '2026-03-05',
    excerpt: 'Prijedlog izmjena Ovršnog zakona predviđa potpunu digitalizaciju postupka ovrhe na novčanim sredstvima, s ciljem smanjenja administrativnog tereta za sudove.',
    url: 'https://www.novi-informator.net',
  },
  {
    id: '10',
    title: 'Objavljen godišnji izvještaj o radu pravosuđa za 2025. godinu',
    source: 'Narodne Novine',
    date: '2026-03-01',
    excerpt: 'Ministarstvo pravosuđa objavilo je godišnji izvještaj iz kojeg proizlazi da su sudovi u 2025. godini riješili 1,2 milijuna predmeta, što je povećanje od 7% u odnosu na 2024.',
    url: 'https://www.nn.hr',
  },
]

const SOURCES = ['IUS-INFO', 'Novi Informator', 'Narodne Novine'] as const
type Source = (typeof SOURCES)[number]

const SOURCE_COLOURS: Record<Source, string> = {
  'IUS-INFO': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  'Novi Informator': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  'Narodne Novine': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
}

export default function LegalNewsPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('legalNews')

  const [activeSource, setActiveSource] = useState<Source | 'all'>('all')

  const filtered =
    activeSource === 'all' ? MOCK_NEWS : MOCK_NEWS.filter(n => n.source === activeSource)

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(locale === 'hr' ? 'hr-HR' : locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: t('legalNews.breadcrumbNews'), href: `/${locale}/novosti` },
          { label: t('legalNews.title') },
        ]}
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('legalNews.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-6">{t('legalNews.subtitle')}</p>

      {/* Source filter */}
      <div
        className="flex flex-wrap gap-2 mb-8"
        role="group"
        aria-label={t('legalNews.filterBySource')}
      >
        <button
          onClick={() => setActiveSource('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            activeSource === 'all'
              ? 'bg-[color:var(--color-brand)] text-white border-[color:var(--color-brand)]'
              : 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] border-[color:var(--color-border)] hover:border-[color:var(--color-brand)]'
          }`}
        >
          {t('legalNews.filterAll')}
        </button>
        {SOURCES.map(src => (
          <button
            key={src}
            onClick={() => setActiveSource(src)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              activeSource === src
                ? 'bg-[color:var(--color-brand)] text-white border-[color:var(--color-brand)]'
                : 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] border-[color:var(--color-border)] hover:border-[color:var(--color-brand)]'
            }`}
          >
            {src}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-8 py-20 text-center">
          <div className="text-5xl mb-4">⚖️</div>
          <p className="text-[color:var(--color-text-muted)] text-lg">{t('legalNews.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(item => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden hover:shadow-md transition-all flex flex-col"
            >
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLOURS[item.source]}`}
                  >
                    {item.source}
                  </span>
                  <time
                    className="text-xs text-[color:var(--color-text-muted)] shrink-0"
                    dateTime={item.date}
                  >
                    {formatDate(item.date)}
                  </time>
                </div>
                <h2 className="text-base font-semibold text-[color:var(--color-heading)] group-hover:text-[color:var(--color-brand)] mb-2 line-clamp-3 transition-colors">
                  {item.title}
                </h2>
                <p className="text-sm text-[color:var(--color-text-muted)] line-clamp-3 flex-1 mb-4">
                  {item.excerpt}
                </p>
                <span className="text-sm font-medium text-[color:var(--color-brand)] flex items-center gap-1">
                  {t('legalNews.readMore')}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-[color:var(--color-text-muted)] text-center">
        {t('legalNews.disclaimer')}
      </p>
    </div>
  )
}
