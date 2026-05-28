import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DarkModeToggle } from './DarkModeToggle'
import { LanguageSwitch } from './LanguageSwitch'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/api/auth'

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
          className="absolute top-full left-0 pt-1 min-w-48 z-50"
        >
          <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg py-1">
            {items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    'block px-4 py-2 text-sm hover:bg-[color:var(--color-surface-subtle)] hover:text-[color:var(--color-heading)] transition-colors',
                    isActive ? 'text-[color:var(--color-heading)] font-semibold' : 'text-[color:var(--color-text)]',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
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
  // Without this, the header showed "Login / Register" even after a successful
  // login — making a working login look like it did nothing.
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await logout()
    navigate(`/${lang}`)
  }

  const navItems = [
    {
      label: t('courts'),
      items: [
        { to: `/${lang}/sudovi`, label: t('courtsList') },
        { to: `/${lang}/mapa`, label: t('map') },
        { to: `/${lang}/sudovi/nadleznost`, label: t('jurisdictionFinder') },
        { to: `/${lang}/sudovi/performanse`, label: t('courtPerformance') },
        { to: `/${lang}/pristojbe`, label: t('calculator') },
      ],
    },
    {
      label: t('decisions'),
      items: [
        { to: `/${lang}/sudska-praksa/pretraga`, label: t('decisionsSearch') },
        { to: `/${lang}/eur-lex`, label: t('eurlexSearch', 'EUR-Lex search') },
        { to: `/${lang}/novosti/pravne-vijesti`, label: t('legalNews') },
        { to: `/${lang}/rokovi`, label: t('deadlines') },
      ],
    },
    {
      label: t('services'),
      items: [
        { to: `/${lang}/dokumenti/generator`, label: t('documentGenerator') },
        { to: `/${lang}/pravna-pomoc`, label: t('legalAid') },
        { to: `/${lang}/pracenje`, label: t('watchlist') },
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
      label: t('bankruptcy'),
      items: [
        { to: `/${lang}/stecaj/oglasi`, label: t('bankruptcyListings') },
        { to: `/${lang}/stecaj/duznici`, label: t('bankruptcyDebtors') },
        { to: `/${lang}/stecaj/upravitelji`, label: t('administrators') },
        { to: `/${lang}/stecaj/zakoni`, label: t('bankruptcyLaws') },
      ],
    },
    {
      label: t('about'),
      items: [
        { to: `/${lang}/o-nama`, label: t('about') },
        { to: `/${lang}/kontakt`, label: t('contact') },
        { to: `/${lang}/galerije`, label: t('galleries') },
        { to: `/${lang}/mediji`, label: t('media') },
        { to: `/${lang}/dokumenti`, label: t('documents') },
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
            className="flex items-center shrink-0 hover:opacity-90 transition-opacity gap-2"
            aria-label="Sudačka Mreža — Početna"
          >
            {/* Croatian flag — pointing left */}
            <svg viewBox="0 0 30 20" className="h-7 w-auto drop-shadow-sm" aria-label="Hrvatska" role="img" style={{ transform: 'scaleX(-1)' }}>
              <rect width="30" height="6.67" fill="#FF0000" />
              <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
              <rect y="13.33" width="30" height="6.67" fill="#171796" />
              <g transform="translate(9,2) scale(0.24)">
                <rect x="0" y="0" width="50" height="65" fill="#FF0000" stroke="#FFFFFF" strokeWidth="2" rx="2" />
                <rect x="10" y="0" width="10" height="13" fill="#FFFFFF" />
                <rect x="30" y="0" width="10" height="13" fill="#FFFFFF" />
                <rect x="0" y="13" width="10" height="13" fill="#FFFFFF" />
                <rect x="20" y="13" width="10" height="13" fill="#FFFFFF" />
                <rect x="40" y="13" width="10" height="13" fill="#FFFFFF" />
                <rect x="10" y="26" width="10" height="13" fill="#FFFFFF" />
                <rect x="30" y="26" width="10" height="13" fill="#FFFFFF" />
                <rect x="0" y="39" width="10" height="13" fill="#FFFFFF" />
                <rect x="20" y="39" width="10" height="13" fill="#FFFFFF" />
                <rect x="40" y="39" width="10" height="13" fill="#FFFFFF" />
                <rect x="10" y="52" width="10" height="13" fill="#FFFFFF" />
                <rect x="30" y="52" width="10" height="13" fill="#FFFFFF" />
              </g>
            </svg>

            <img
              src="/assets/sudacka-mreza-logo.gif"
              alt="Sudačka Mreža"
              className="h-12 w-auto bg-white/90 rounded-lg px-3 py-1.5"
            />

            {/* EU flag — pointing right */}
            <svg viewBox="0 0 30 20" className="h-7 w-auto drop-shadow-sm" aria-label="European Union" role="img">
              <rect width="30" height="20" fill="#003399" />
              {[...Array(12)].map((_, i) => {
                const angle = (i * 30 - 90) * Math.PI / 180
                const cx = 15 + 6 * Math.cos(angle)
                const cy = 10 + 6 * Math.sin(angle)
                return (
                  <polygon
                    key={i}
                    points={[...Array(5)].map((_, j) => {
                      const a = ((j * 144) - 90) * Math.PI / 180
                      return `${cx + 1.2 * Math.cos(a)},${cy + 1.2 * Math.sin(a)}`
                    }).join(' ')}
                    fill="#FFCC00"
                  />
                )
              })}
            </svg>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {navItems.map(item => (
              <NavDropdown key={item.label} label={item.label} items={item.items} />
            ))}
            <NavLink
              to={`/${lang}/statistika`}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-[color:var(--color-brand-gold)] border-b-2 border-[color:var(--color-brand-gold)]'
                    : 'text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)]'
                }`
              }
            >
              {t('statistics')}
            </NavLink>
          </nav>

          {/* Right-side controls */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Language switch stays visible at every width — a multilingual
                legal site must not bury its language selector in the hamburger
                menu on mobile. */}
            <LanguageSwitch />
            <DarkModeToggle />

            {/* Auth buttons. Visible from the `sm` breakpoint up — NOT gated
                at `lg` — so the admin link / sign-in state stays in the header
                on narrow laptop windows instead of being buried in the
                hamburger menu. Below `sm` (true phones) it lives in MobileNav. */}
            <div className="hidden sm:flex items-center gap-2 ml-2">
              {loading ? null : user ? (
                <>
                  {user.role === 'admin' && (
                    <Link
                      to={`/${lang}/admin`}
                      className="px-3 py-1.5 text-sm font-medium text-[color:var(--color-brand-gold)] border border-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
                    >
                      {t('adminConsole', 'Administracija')}
                    </Link>
                  )}
                  {(user.role === 'editor' || user.role === 'data_editor' || user.role === 'legal_entity') && (
                    <Link
                      to={`/${lang}/editor`}
                      className="px-3 py-1.5 text-sm font-medium text-[color:var(--color-brand-gold)] border border-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
                    >
                      {t('editorConsole', 'Uređivanje')}
                    </Link>
                  )}
                  <Link
                    to={`/${lang}/moja-knjiznica`}
                    className="px-3 py-1.5 text-sm font-medium text-[color:var(--color-brand-gold)] border border-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
                  >
                    {t('myLibrary', 'Moja knjižnica')}
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-3 py-1.5 text-sm font-semibold bg-[color:var(--color-brand-gold)] text-[color:var(--color-brand-navy)] rounded hover:bg-[color:var(--color-brand-gold-light)] transition-colors"
                  >
                    {t('signOut', 'Odjava')}
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
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
