import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import { Footer } from './Footer'

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
              <a href={crumb.pathname} className="text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors">
                {crumb.handle?.breadcrumb}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function AppShell() {
  const { t } = useTranslation('nav')
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  // Move focus to main on route change (SPA accessibility requirement)
  useEffect(() => {
    const h1 = mainRef.current?.querySelector<HTMLElement>('h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: false })
    } else {
      mainRef.current?.focus({ preventScroll: false })
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

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 outline-none"
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
