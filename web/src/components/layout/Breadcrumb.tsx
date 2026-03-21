import { Link, useMatches, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../../i18n/index'

export interface BreadcrumbHandle {
  /** i18n key in 'nav' namespace, or a static label */
  crumb: string
  /** If true the crumb is a translation key; otherwise used as-is */
  i18nKey?: boolean
}

interface Match {
  id: string
  pathname: string
  handle?: BreadcrumbHandle
}

/**
 * Renders a breadcrumb trail for pages at depth ≥ 2.
 * Each route that should appear in breadcrumbs exports a `handle` with `crumb`.
 */
export function Breadcrumb() {
  const matches = useMatches() as Match[]
  const { lang } = useParams<{ lang: SupportedLanguage }>()
  const { t } = useTranslation('nav')

  // Collect only matches that have a handle.crumb
  const crumbs = matches.filter((m) => m.handle?.crumb)

  // Don't render at depth < 2
  if (crumbs.length < 2) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]"
    >
      <ol
        className="
          max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
          flex items-center gap-1 py-2 text-sm text-[var(--color-text-muted)]
          flex-wrap
        "
      >
        {/* Home crumb always first */}
        <li>
          <Link
            to={`/${lang}`}
            className="hover:text-[var(--color-text-link-hover)] transition-colors"
          >
            {t('home')}
          </Link>
        </li>

        {crumbs.map((crumb, idx) => {
          const label = crumb.handle!.i18nKey !== false
            ? t(crumb.handle!.crumb)
            : crumb.handle!.crumb
          const isLast = idx === crumbs.length - 1

          return (
            <li key={crumb.id} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-[var(--color-border-strong)]">/</span>
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-[var(--color-text)] font-medium"
                >
                  {label}
                </span>
              ) : (
                <Link
                  to={crumb.pathname}
                  className="hover:text-[var(--color-text-link-hover)] transition-colors"
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
