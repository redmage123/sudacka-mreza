import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from './LanguageSwitch'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/api/auth'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { t } = useTranslation('nav')
  const params = useParams<{ lang: string }>()
  const lang = params.lang ?? 'hr'
  const closeRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await logout()
    onClose()
    navigate(`/${lang}`)
  }

  // Focus close button when opened
  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus()
    }
  }, [isOpen])

  // Trap focus inside mobile nav
  useEffect(() => {
    if (!isOpen) return
    const nav = navRef.current
    if (!nav) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = nav!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const navGroups = [
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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <nav
        ref={navRef}
        id="mobile-nav"
        aria-label="Mobile navigation"
        className="fixed inset-y-0 right-0 z-50 w-80 max-w-full bg-[color:var(--color-brand-navy)] flex flex-col lg:hidden overflow-y-auto"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[color:var(--color-brand-navy-light)]">
          <LanguageSwitch />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('closeMenu')}
            className="rounded p-2 text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-4 py-6 space-y-6">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-brand-gold)] mb-2">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map(item => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className="block px-3 py-2 rounded text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] hover:text-[color:var(--color-brand-gold-light)] transition-colors text-sm"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="border-t border-[color:var(--color-brand-navy-light)] pt-4 space-y-1">
            {[
              { to: `/${lang}/statistika`, label: t('statistics') },
            { to: `/${lang}/pristojbe`, label: t('calculator') },
              { to: `/${lang}/pravna-pomoc`, label: t('legalAid') },
              { to: `/${lang}/vijesti`, label: t('news') },
              { to: `/${lang}/galerije`, label: t('galleries') },
              { to: `/${lang}/o-nama`, label: t('about') },
              { to: `/${lang}/kontakt`, label: t('contact') },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className="block px-3 py-2 rounded text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] hover:text-[color:var(--color-brand-gold-light)] transition-colors text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 border-t border-[color:var(--color-brand-navy-light)] flex gap-2">
          {loading ? null : user ? (
            <>
              <Link
                to={`/${lang}/moja-knjiznica`}
                onClick={onClose}
                className="flex-1 text-center px-4 py-2 text-sm font-medium border border-[color:var(--color-brand-gold)] text-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
              >
                {t('myLibrary', 'Moja knjižnica')}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 text-center px-4 py-2 text-sm font-semibold bg-[color:var(--color-brand-gold)] text-[color:var(--color-brand-navy)] rounded hover:bg-[color:var(--color-brand-gold-light)] transition-colors"
              >
                {t('signOut', 'Odjava')}
              </button>
            </>
          ) : (
            <>
              <Link
                to={`/${lang}/login`}
                onClick={onClose}
                className="flex-1 text-center px-4 py-2 text-sm font-medium border border-[color:var(--color-brand-gold)] text-[color:var(--color-brand-gold)] rounded hover:bg-[color:var(--color-brand-gold)] hover:text-[color:var(--color-brand-navy)] transition-colors"
              >
                {t('login')}
              </Link>
              <Link
                to={`/${lang}/register`}
                onClick={onClose}
                className="flex-1 text-center px-4 py-2 text-sm font-semibold bg-[color:var(--color-brand-gold)] text-[color:var(--color-brand-navy)] rounded hover:bg-[color:var(--color-brand-gold-light)] transition-colors"
              >
                {t('register')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
