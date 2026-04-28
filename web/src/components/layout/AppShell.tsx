import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useMatches, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { InstallPrompt } from '@/components/ui'
import { CookieConsent } from '@/components/CookieConsent'
import { ChatWidget } from '@/components/chat/ChatWidget'

interface BreadcrumbMatch {
  id: string
  pathname: string
  handle?: {
    breadcrumb?: string
  }
}

function Breadcrumb() {
  const matches = useMatches() as BreadcrumbMatch[]
  const crumbs = matches.filter(m => m.handle?.breadcrumb)

  if (crumbs.length < 2) return null

  return (
    <nav aria-label="Breadcrumb" className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <ol className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-sm">
        {crumbs.map((crumb, idx) => (
          <li key={crumb.id} className="flex items-center gap-2">
            {idx > 0 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-[color:var(--color-text-muted)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            {idx === crumbs.length - 1 ? (
              <span aria-current="page" className="text-[color:var(--color-text-muted)]">
                {crumb.handle?.breadcrumb}
              </span>
            ) : (
              <Link to={crumb.pathname} className="text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors">
                {crumb.handle?.breadcrumb}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function AppShell() {
  const { t, i18n } = useTranslation('nav')
  const location = useLocation()
  const { lang } = useParams<{ lang: string }>()
  const mainRef = useRef<HTMLElement>(null)

  // Sync i18next language with the URL /:lang param so translations render in
  // the correct language immediately on load (not just after a manual switch).
  useEffect(() => {
    if (lang) {
      void i18n.changeLanguage(lang)
    }
  }, [lang, i18n])

  // Move focus to main on route change (SPA accessibility requirement)
  useEffect(() => {
    const h1 = mainRef.current?.querySelector<HTMLElement>('h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    } else {
      mainRef.current?.focus({ preventScroll: true })
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip link — first focusable element, visible only on :focus */}
      <a href="#main-content" className="skip-link">
        {t('skipToContent')}
      </a>

      <Header />
      <Breadcrumb />

      {/* Content row: Sidebar (desktop only) + main */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 min-w-0 outline-none"
        >
          <Outlet />
        </main>
      </div>

      <Footer />
      <InstallPrompt />
      <CookieConsent />
      <ChatWidget />
    </div>
  )
}
