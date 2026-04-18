import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { usePageTitle } from '@/hooks/usePageTitle'

interface DonorLogo {
  src: string
  alt: string
  href: string
}

const DONORS: DonorLogo[] = [
  { src: '/assets/donors/netherlands-logo.jpg',  alt: 'Ambasada Kraljevine Nizozemske',           href: 'https://www.netherlandsandyou.nl/your-country-and-the-netherlands/croatia' },
  { src: '/assets/donors/rijks.gif',             alt: 'Ministarstvo vanjskih poslova Nizozemske', href: 'https://www.government.nl/ministries/ministry-of-foreign-affairs' },
  { src: '/assets/donors/norway-coat.png',       alt: 'Ambasada Kraljevine Norveške',             href: 'https://www.norway.no/hr/croatia/' },
  { src: '/assets/donors/norway-embassy.png',    alt: 'Norveška ambasada',                        href: 'https://www.norway.no/hr/croatia/' },
  { src: '/assets/donors/osce.png',              alt: 'OSCE',                                     href: 'https://www.osce.org/zagreb' },
  { src: '/assets/donors/us-embassy.jpg',        alt: 'Ambasada SAD-a u Hrvatskoj',               href: 'https://hr.usembassy.gov/' },
  { src: '/assets/donors/aba.jpg',               alt: 'ABA — American Bar Association',           href: 'https://www.americanbar.org/' },
  { src: '/assets/donors/ned.jpg',               alt: 'NED — National Endowment for Democracy',   href: 'https://www.ned.org/' },
  { src: '/assets/donors/irz.gif',               alt: 'IRZ — Deutsch-Südosteuropäische Rechtsakademie', href: 'https://www.irz.de/' },
  { src: '/assets/donors/span.jpg',              alt: 'SPAN',                                     href: '#' },
  { src: '/assets/donors/canada.jpg',            alt: 'Vlada Kanade',                             href: 'https://www.international.gc.ca/' },
]

export default function AboutPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('about')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('about') },
        ]}
      />

      {/* About section */}
      <section aria-labelledby="about-heading">
        <h1
          id="about-heading"
          className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold-light)] mb-6"
        >
          {t('about.title')}
        </h1>
        <div className="prose prose-lg max-w-none text-[color:var(--color-text)]">
          <p>{t('about.intro1')}</p>
          <p>{t('about.intro2')}</p>
          <p>{t('about.intro3')}</p>
        </div>
      </section>

      {/* Donors / funders section */}
      <section aria-labelledby="donors-heading">
        <h2
          id="donors-heading"
          className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold-light)] mb-2"
        >
          {t('about.donors.title')}
        </h2>
        <p className="text-[color:var(--color-text-muted)] mb-8">
          {t('about.donors.subtitle')}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {DONORS.map(donor => (
            <a
              key={donor.src}
              href={donor.href}
              target="_blank"
              rel="noopener noreferrer"
              title={donor.alt}
              className="flex items-center justify-center p-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-brand-gold)] hover:shadow-sm transition-all"
            >
              <img
                src={donor.src}
                alt={donor.alt}
                className="max-h-14 max-w-full object-contain grayscale hover:grayscale-0 transition-all"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      </section>

    </div>
  )
}
