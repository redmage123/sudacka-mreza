import { NavLink, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

interface SidebarItem {
  to: string
  label: string
}

interface SidebarSection {
  heading: string
  items: SidebarItem[]
}

export function Sidebar() {
  const { t } = useTranslation('nav')
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'hr'

  const sections: SidebarSection[] = [
    {
      heading: t('decisions'),
      items: [
        { to: `/${lang}/sudska-praksa/pretraga`, label: t('decisionsSearch') },
        { to: `/${lang}/sudska-praksa/vts`, label: t('decisionsVTS') },
        { to: `/${lang}/sudska-praksa/esljp`, label: t('decisionsESLJP') },
      ],
    },
    {
      heading: t('experts'),
      items: [
        { to: `/${lang}/strucnjaci/vjestaci`, label: t('expertWitnesses') },
        { to: `/${lang}/strucnjaci/tumaci`, label: t('interpreters') },
      ],
    },
    {
      heading: t('courts'),
      items: [
        { to: `/${lang}/sudovi`, label: t('courtsList') },
        { to: `/${lang}/sudovi/dorh`, label: t('stateAttorneys') },
        { to: `/${lang}/sudovi/nadleznost`, label: t('jurisdictionFinder') },
        { to: `/${lang}/mapa`, label: t('map') },
      ],
    },
    {
      heading: t('bankruptcy'),
      items: [
        { to: `/${lang}/stecaj/oglasi`, label: t('bankruptcyListings') },
        { to: `/${lang}/stecaj/upravitelji`, label: t('administrators') },
        { to: `/${lang}/stecaj/zakoni`, label: t('bankruptcyLaws') },
        { to: `/${lang}/stecaj/odluke`, label: t('bankruptcyDecisions') },
      ],
    },
    {
      heading: t('more'),
      items: [
        { to: `/${lang}/statistika`, label: t('statistics') },
        { to: `/${lang}/pristojbe`, label: t('calculator') },
        { to: `/${lang}/pravna-pomoc`, label: t('legalAid') },
        { to: `/${lang}/vijesti`, label: t('news') },
        { to: `/${lang}/o-nama`, label: t('about') },
        { to: `/${lang}/kontakt`, label: t('contact') },
      ],
    },
  ]

  return (
    // AC-3: hidden on < 1024 px via CSS, always in DOM (not unmounted)
    <aside
      className="hidden lg:block w-56 shrink-0 border-r border-[color:var(--color-border)] overflow-y-auto"
      aria-label={t('sidebarNav')}
    >
      <nav className="py-6 px-3 space-y-6">
        {sections.map(section => (
          <div key={section.heading}>
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)]">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      [
                        'block rounded px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-[color:var(--color-surface-subtle)] font-semibold text-[color:var(--color-heading)]'
                          : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-subtle)] hover:text-[color:var(--color-heading)]',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
