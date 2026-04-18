import { Outlet, useLocation } from 'react-router'

/**
 * PlaceholderPage — minimal route stub for Sprint 1.
 *
 * Renders the current route path in an <h1> and nothing else.
 * Every route that does not yet have a real page implementation
 * can point to this component.  It will be replaced by real pages
 * in Sprint 2+.
 */
export default function PlaceholderPage() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-4">
        {pathname}
      </h1>
      <p className="text-[color:var(--color-text-muted)] text-sm">
        This page is a placeholder and will be implemented in a future sprint.
      </p>
      {/* Outlet allows nested routes to render inside this placeholder */}
      <Outlet />
    </div>
  )
}
