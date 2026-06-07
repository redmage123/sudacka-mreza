import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation('nav')
  const { t: tc } = useTranslation('common')
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'hr'
  const year = new Date().getFullYear()

  const columns = [
    // REDESIGN §3.1: Sudska Praksa cut from main menu (mirror Header.tsx).
    {
      heading: t('experts'),
      links: [
        { to: `/${lang}/strucnjaci/vjestaci`, label: t('expertWitnesses') },
        { to: `/${lang}/strucnjaci/tumaci`, label: t('interpreters') },
        { to: `/${lang}/sudovi`, label: t('courts') },
        { to: `/${lang}/sudovi/nadleznost`, label: t('jurisdictionFinder') },
      ],
    },
    {
      heading: t('bankruptcy'),
      links: [
        { to: `/${lang}/stecaj/oglasi`, label: t('bankruptcyListings') },
        { to: `/${lang}/stecaj/duznici`, label: t('bankruptcyDebtors') },
        { to: `/${lang}/stecaj/upravitelji`, label: t('administrators') },
        { to: `/${lang}/pristojbe`, label: t('calculator') },
        { to: `/${lang}/pravna-pomoc`, label: t('legalAid') },
      ],
    },
  ]

  return (
    <footer className="bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Three-column sitemap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
          {columns.map(col => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-brand-gold)] mb-3">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-[color:var(--color-text-inverse)] opacity-80 hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Legal bar */}
        <div className="border-t border-[color:var(--color-brand-navy-light)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[color:var(--color-text-inverse)] opacity-70">
          <p>© {year} {tc('copyright')}. {tc('allRightsReserved')}.</p>
          <nav className="flex items-center gap-4 flex-wrap justify-center sm:justify-end" aria-label="Legal links">
            <Link to={`/${lang}/privatnost`} className="hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors">
              {tc('privacyPolicy')}
            </Link>
            <Link to={`/${lang}/kolacici`} className="hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors">
              {tc('cookiePolicy')}
            </Link>
            <Link to={`/${lang}/uvjeti`} className="hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors">
              {tc('termsOfService')}
            </Link>
            <Link to={`/${lang}/pristupacnost`} className="hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors">
              {tc('accessibility')}
            </Link>
            <Link to={`/${lang}/donacija`} className="hover:opacity-100 hover:text-[color:var(--color-brand-gold-light)] transition-colors">
              {tc('donate')}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
