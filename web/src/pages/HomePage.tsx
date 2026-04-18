import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Scale,
  Users,
  Languages,
  Building2,
  FileText,
  Calculator,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import MetaTags from '@/components/seo/MetaTags'
import { getNewsPosts } from '@/api/news'
import { searchDecisions } from '@/api/court-decisions'
import { getExpertWitnesses } from '@/api/expert-witnesses'
import { getInterpreters } from '@/api/interpreters'
import { getCourts } from '@/api/courts'
import { formatDate } from '@/utils/dates'
import type { NewsPostSummary } from '@/api/types'

const DONORS = [
  { src: '/assets/donors/osce.png', alt: 'OSCE', href: 'https://www.osce.org/zagreb' },
  { src: '/assets/donors/netherlands-logo.jpg', alt: 'Netherlands', href: 'https://www.netherlandsandyou.nl/your-country-and-the-netherlands/croatia' },
  { src: '/assets/donors/norway-embassy.png', alt: 'Norway', href: 'https://www.norway.no/hr/croatia/' },
  { src: '/assets/donors/us-embassy.jpg', alt: 'US Embassy', href: 'https://hr.usembassy.gov/' },
  { src: '/assets/donors/aba.jpg', alt: 'ABA', href: 'https://www.americanbar.org/' },
  { src: '/assets/donors/ned.jpg', alt: 'NED', href: 'https://www.ned.org/' },
  { src: '/assets/donors/irz.gif', alt: 'IRZ', href: 'https://www.irz.de/' },
  { src: '/assets/donors/canada.jpg', alt: 'Canada', href: 'https://www.international.gc.ca/' },
  { src: '/assets/donors/span.jpg', alt: 'SPAN', href: 'https://www.span.hr/' },
]

interface StatsState {
  decisions: number | null
  experts: number | null
  interpreters: number | null
  courts: number | null
}

const QUICK_ACCESS = [
  {
    titleKey: 'home.sections.decisions',
    descKey: 'home.sections.decisionsDesc',
    icon: Scale,
    path: (lang: string) => `/${lang}/sudska-praksa/pretraga`,
  },
  {
    titleKey: 'home.sections.experts',
    descKey: 'home.sections.expertsDesc',
    icon: Users,
    path: (lang: string) => `/${lang}/strucnjaci/vjestaci`,
  },
  {
    titleKey: 'home.sections.interpreters',
    descKey: 'home.sections.interpretersDesc',
    icon: Languages,
    path: (lang: string) => `/${lang}/strucnjaci/tumaci`,
  },
  {
    titleKey: 'home.sections.courts',
    descKey: 'home.sections.courtsDesc',
    icon: Building2,
    path: (lang: string) => `/${lang}/sudovi`,
  },
  {
    titleKey: 'home.sections.bankruptcy',
    descKey: 'home.sections.bankruptcyDesc',
    icon: FileText,
    path: (lang: string) => `/${lang}/stecaj`,
  },
  {
    titleKey: 'home.sections.calculator',
    descKey: 'home.sections.calculatorDesc',
    icon: Calculator,
    path: (lang: string) => `/${lang}/pristojbe`,
  },
]

export default function HomePage() {
  const { lang } = useParams<{ lang: string }>()
  const { t } = useTranslation('common')
  const locale = lang ?? 'hr'

  const [news, setNews] = useState<NewsPostSummary[] | null>(null)
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState(false)

  const [stats, setStats] = useState<StatsState | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    setNewsLoading(true)
    setNewsError(false)
    getNewsPosts({ limit: 5, locale })
      .then((data) => {
        if (isMounted.current) {
          setNews(data.docs)
          setNewsLoading(false)
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setNewsError(true)
          setNewsLoading(false)
        }
      })
  }, [locale])

  useEffect(() => {
    setStatsLoading(true)
    Promise.all([
      searchDecisions({ locale, page: 1 }).then((r) => r.totalDocs),
      getExpertWitnesses({ locale, limit: 1 }).then((r) => r.totalDocs),
      getInterpreters({ locale, limit: 1 }).then((r) => r.totalDocs),
      getCourts({ locale }).then((r) => r.totalDocs),
    ])
      .then(([decisions, experts, interpreters, courts]) => {
        if (isMounted.current) {
          setStats({ decisions, experts, interpreters, courts })
          setStatsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Stats fetch failed:', err)
        if (isMounted.current) {
          setStats(null)
          setStatsLoading(false)
        }
      })
  }, [locale])

  const fmtNumber = (n: number) =>
    n.toLocaleString(locale === 'hr' ? 'hr-HR' : 'en-US')

  return (
    <div>
      <MetaTags
        title={t('home.hero.headline')}
        description={t('home.hero.subtitle')}
        lang={locale as 'hr' | 'en'}
        canonicalPath={`/${locale}`}
        alternateLangPath={`/${locale === 'hr' ? 'en' : 'hr'}`}
      />
      {/* Hero with logo and visual depth */}
      <section className="relative bg-[color:var(--color-brand-navy)] py-16 px-4 overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'}} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-10 inline-block bg-white rounded-2xl px-12 py-6 shadow-2xl">
            <img
              src="/assets/sudacka-mreza-logo.gif"
              alt="Sudačka Mreža"
              className="h-36 sm:h-44 w-auto"
            />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-[color:var(--color-text-inverse)] mb-4">
            {t('home.hero.headline')}
          </h1>
          <p className="text-lg text-[color:var(--color-text-inverse)] opacity-80 mb-8 max-w-2xl mx-auto">
            {t('home.hero.subtitle')}
          </p>
          <Link
            to={`/${locale}/sudska-praksa/pretraga`}
            className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all bg-[color:var(--color-brand-gold)] text-white px-8 py-3.5 text-base hover:brightness-110 shadow-lg hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]"
          >
            <Scale size={20} />
            {t('home.hero.cta')}
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)] py-8 px-4">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { key: 'decisions', icon: Scale, value: stats?.decisions },
            { key: 'experts', icon: Users, value: stats?.experts },
            { key: 'interpreters', icon: Languages, value: stats?.interpreters },
            { key: 'courts', icon: Building2, value: stats?.courts },
          ].map(({ key, icon: StatIcon, value }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <StatIcon size={24} className="text-[color:var(--color-brand-gold)]" />
              <span className="text-2xl font-bold text-[color:var(--color-heading)]">
                {statsLoading ? '...' : value != null ? fmtNumber(value) : '—'}
              </span>
              <span className="text-sm text-[color:var(--color-text-muted)]">
                {t(`home.stats.${key}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick-access grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACCESS.map(({ titleKey, descKey, icon: Icon, path }) => (
            <Link key={titleKey} to={path(locale)} className="focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)] rounded-lg">
              <Card hoverable className="h-full">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 text-[color:var(--color-heading)]">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-[color:var(--color-heading)] mb-1">
                      {t(titleKey)}
                    </h2>
                    <p className="text-sm text-[color:var(--color-text-muted)]">{t(descKey)}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest news */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[color:var(--color-heading)]">
            {t('home.news.title')}
          </h2>
          <Link
            to={`/${locale}/vijesti`}
            className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors"
          >
            {t('home.news.viewAll')}
          </Link>
        </div>

        {newsLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height="h-16" />
            ))}
          </div>
        )}

        {!newsLoading && newsError && (
          <p className="text-sm text-[color:var(--color-text-muted)] py-4">
            {t('home.news.noNewsYet')}
          </p>
        )}

        {!newsLoading && !newsError && news && (
          <div className="divide-y divide-[color:var(--color-border)]">
            {news.map((post) => (
              <div key={post.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/${locale}/vijesti/${post.slug}`}
                      className="font-medium text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors block truncate"
                    >
                      {post.title}
                    </Link>
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-0.5">
                      {post.published_at ? formatDate(post.published_at, lang) : ''}
                    </p>
                  </div>
                  {post.category && (
                    <Badge variant="neutral" className="shrink-0">{post.category}</Badge>
                  )}
                </div>
                <Link
                  to={`/${locale}/vijesti/${post.slug}`}
                  className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors mt-1 inline-block"
                >
                  {t('home.news.readMore')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Stats bar */}
      {(statsLoading || stats !== null) && (
        <section className="bg-[color:var(--color-surface-subtle)] border-t border-[color:var(--color-border)] py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              {statsLoading ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton height="h-8" width="w-24 mx-auto" />
                      <Skeleton height="h-4" width="w-32 mx-auto" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div>
                    <p className="text-3xl font-bold text-[color:var(--color-heading)]">
                      {stats?.decisions != null ? fmtNumber(stats.decisions) : '—'}
                    </p>
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                      {t('home.stats.decisions')}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[color:var(--color-heading)]">
                      {stats?.experts != null ? fmtNumber(stats.experts) : '—'}
                    </p>
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                      {t('home.stats.experts')}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[color:var(--color-heading)]">
                      {stats?.interpreters != null ? fmtNumber(stats.interpreters) : '—'}
                    </p>
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                      {t('home.stats.interpreters')}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[color:var(--color-heading)]">
                      {stats?.courts != null ? fmtNumber(stats.courts) : '—'}
                    </p>
                    <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
                      {t('home.stats.courts')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}
      {/* Donor logos */}
      <section className="border-t border-[color:var(--color-border)] py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h3 className="text-center text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)] mb-8">
            {t('home.donors.title')}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {DONORS.map((d) => (
              <img
                key={d.alt}
                src={d.src}
                alt={d.alt}
                className="h-10 w-auto object-contain grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
