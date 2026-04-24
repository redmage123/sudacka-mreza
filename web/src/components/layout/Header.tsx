import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DarkModeToggle } from './DarkModeToggle'
import { LanguageSwitch } from './LanguageSwitch'
import { MobileNav } from './MobileNav'

interface NavDropdownItem {
  to: string
  label: string
}

interface NavDropdownProps {
  label: string
  items: NavDropdownItem[]
}

function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)] transition-colors"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 min-w-48 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg py-1 z-50"
        >
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  'block px-4 py-2 text-sm hover:bg-[color:var(--color-surface-subtle)] hover:text-[color:var(--color-brand-navy)] transition-colors',
                  isActive ? 'text-[color:var(--color-brand-navy)] font-semibold' : 'text-[color:var(--color-text)]',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { t } = useTranslation('nav')
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'hr'
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    {
      label: t('decisions'),
      items: [
        { to: `/${lang}/sudska-praksa/pretraga`, label: t('decisionsSearch') },
        { to: `/${lang}/sudska-praksa/vts`, label: t('decisionsVTS') },
        { to: `/${lang}/sudska-praksa/esljp`, label: t('decisionsESLJP') },
      ],
    },
    {
      label: t('experts'),
      items: [
        { to: `/${lang}/strucnjaci/vjestaci`, label: t('expertWitnesses') },
        { to: `/${lang}/strucnjaci/tumaci`, label: t('interpreters') },
      ],
    },
    {
      label: t('courts'),
      items: [
        { to: `/${lang}/sudovi`, label: t('courtsList') },
        { to: `/${lang}/sudovi/dorh`, label: t('stateAttorneys') },
        { to: `/${lang}/sudovi/nadleznost`, label: t('jurisdictionFinder') },
      ],
    },
    {
      label: t('bankruptcy'),
      items: [
        { to: `/${lang}/stecaj/oglasi`, label: t('bankruptcyListings') },
        { to: `/${lang}/stecaj/upravitelji`, label: t('administrators') },
        { to: `/${lang}/stecaj/zakoni`, label: t('bankruptcyLaws') },
      ],
    },
  ]

  return (
    <>
      <header className="sticky top-0 z-30 h-16 lg:h-20 bg-[color:var(--color-brand-navy)] shadow-md">
        <div className="mx-auto h-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-4">

          {/* Logo */}
          <Link
            to={`/${lang}`}
            className="flex items-center gap-2 shrink-0 text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)] transition-colors"
            aria-label="Sudačka Mreža — Početna"
          >
            {/* Placeholder logo — SVG scales in at build time */}
            <div className="w-8 h-8 rounded bg-[color:var(--color-brand-gold)] flex items-center justify-center shrink-0" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[color:var(--color-brand-navy)]">
                <path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-sm lg:text-base leading-tight">
              Sudačka<br className="hidden sm:block lg:hidden" />
              {' '}Mreža
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {navItems.map(item => (
              <NavDropdown key={item.label} label={item.label} items={item.items} />
            ))}
            <NavLink
              to={`/${lang}/pristojbe`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[color:var(--color-brand-gold)] border-b-2 border-[color:var(--color-brand-gold)]'
                    : 'text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)]'
                }`
              }
            >
              {t('calculator')}
            </NavLink>
            <NavLink
              to={`/${lang}/pravni-asistent`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[color:var(--color-brand-gold)] border-b-2 border-[color:var(--color-brand-gold)]'
                    : 'text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)]'
                }`
              }
            >
              {t('legalAi')}
            </NavLink>
          </nav>

          {/* Right-side controls */}
          <div className="flex items-center gap-1 ml-auto">
            <div className="hidden sm:block">
              <LanguageSwitch />
            </div>
            <DarkModeToggle />

            {/* Auth buttons — desktop */}
            <div className="hidden lg:flex items-center gap-2 ml-2">
              <Link
                to={`/${lang}/login`}
                className="px-3 py-1.5 text-sm font-medium text-[color:var(--color-brand-gold)] border border-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                to={`/${lang}/register`}
                className="px-3 py-1.5 text-sm font-semibold bg-[color:var(--color-brand-gold)] text-[color:var(--color-brand-navy)] rounded hover:bg-[color:var(--color-brand-gold-light)] transition-colors"
              >
                {t('register')}
              </Link>
            </div>

            {/* Hamburger — mobile */}
            <button
              type="button"
              className="lg:hidden rounded p-2 text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] transition-colors"
              aria-label={t('openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
