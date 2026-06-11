import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useParams, useLocation, Link, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'

const ENDONYMS: Record<string, string> = {
  ar: 'العربية', bg: 'Български', cs: 'Čeština', da: 'Dansk', de: 'Deutsch',
  el: 'Ελληνικά', en: 'English', es: 'Español', et: 'Eesti', eu: 'Euskara',
  fi: 'Suomi', fr: 'Français', ga: 'Gaeilge', hr: 'Hrvatski', hu: 'Magyar',
  is: 'Íslenska', it: 'Italiano', ja: '日本語', lt: 'Lietuvių', lv: 'Latviešu',
  mt: 'Malti', nb: 'Norsk bokmål', nl: 'Nederlands', pl: 'Polski', pt: 'Português',
  ro: 'Română', sk: 'Slovenčina', sl: 'Slovenščina', sv: 'Svenska',
  uk: 'Українська', zh: '中文',
}

export default function AdminLayout() {
  const { user, loading } = useAuth()
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const location = useLocation()
  const locale = lang ?? 'hr'

  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  function switchLang(next: SupportedLanguage) {
    if (next === locale) return
    const pattern = new RegExp(`^/(${SUPPORTED_LANGUAGES.join('|')})`)
    const rest = location.pathname.replace(pattern, '')
    navigate(`/${next}${rest}${location.search}${location.hash}`, { replace: true })
  }

  useEffect(() => {
    if (!collectionsOpen) return
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setCollectionsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [collectionsOpen])

  // Close dropdown on route change.
  useEffect(() => { setCollectionsOpen(false) }, [location.pathname])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="animate-pulse h-64 bg-[color:var(--color-surface-subtle)] rounded" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[color:var(--color-heading)] mb-4">
          {t('admin.notLoggedIn', 'Sign in required')}
        </h1>
        <p className="text-[color:var(--color-text-muted)] mb-6">
          {t('admin.notLoggedInBody', 'You must be signed in as an administrator to access this area.')}
        </p>
        <Link
          to={`/${locale}/prijava`}
          className="inline-block rounded-lg bg-[color:var(--color-brand)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t('auth.login.submit', 'Sign in')}
        </Link>
      </div>
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-700 mb-4">
          {t('admin.forbidden', 'Access denied')}
        </h1>
        <p className="text-[color:var(--color-text-muted)]">
          {t('admin.forbiddenBody', 'This area is restricted to site administrators.')}
        </p>
      </div>
    )
  }

  const topLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center rounded px-3 py-2 text-sm ${
      isActive
        ? 'bg-[color:var(--color-brand)] text-white font-semibold'
        : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-alt)]'
    }`

  const dropdownItemClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded px-3 py-2 text-sm ${
      isActive
        ? 'bg-[color:var(--color-brand)] text-white font-semibold'
        : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-alt)]'
    }`

  const collections = [
    ['courts', t('admin.nav.courts', 'Courts')],
    ['judges', t('admin.nav.judges', 'Judges')],
    ['experts', t('admin.nav.experts', 'Experts')],
    ['interpreters', t('admin.nav.interpreters', 'Interpreters')],
    ['state-attorneys', t('admin.nav.stateAttorneys', 'State attorneys')],
    ['bankruptcy-administrators', t('admin.nav.bankAdmins', 'Bankruptcy admins')],
    ['bankruptcy-debtors', t('admin.nav.bankDebtors', 'Bankruptcy debtors')],
    ['bankruptcy-filings', t('admin.nav.bankFilings', 'Bankruptcy filings')],
    ['laws', t('admin.nav.laws', 'Laws')],
    ['legal-categories', t('admin.nav.categories', 'Categories')],
    ['documents', t('admin.nav.documents', 'Documents')],
    ['pages', t('admin.nav.pages', 'Pages')],
    ['api-keys', t('admin.nav.apiKeys', 'API keys')],
  ] as const

  const collectionsActive = collections.some(([slug]) => location.pathname.endsWith(`/admin/${slug}`))

  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--color-surface-subtle)]">
      {/* Top bar */}
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-2">
            <h1 className="text-lg font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] whitespace-nowrap">
              {t('admin.title', 'Admin')}
            </h1>
            <span className="text-sm text-[color:var(--color-text-muted)] truncate">
              {user.firstName} {user.lastName} · {user.email}
            </span>
            <select
              value={locale}
              onChange={(e) => switchLang(e.target.value as SupportedLanguage)}
              aria-label={t('admin.languageSelect', 'Jezik')}
              className="text-sm border border-[color:var(--color-border)] rounded px-2 py-1 bg-[color:var(--color-surface)] text-[color:var(--color-text)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand)]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l} value={l} lang={l}>
                  {ENDONYMS[l] ?? l.toUpperCase()}
                </option>
              ))}
            </select>
            <Link
              to={`/${locale}`}
              className="text-sm text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] whitespace-nowrap"
            >
              {t('admin.backToSite', 'Natrag na javnu stranicu')}
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-1 pb-2" aria-label={t('admin.title', 'Admin')}>
            <NavLink end to={`/${locale}/admin`} className={topLinkClass}>
              {t('admin.nav.dashboard', 'Dashboard')}
            </NavLink>
            <NavLink to={`/${locale}/admin/users`} className={topLinkClass}>
              {t('admin.nav.users', 'Users')}
            </NavLink>
            <NavLink to={`/${locale}/admin/gdpr`} className={topLinkClass}>
              {t('admin.nav.gdpr', 'GDPR requests')}
            </NavLink>
            <NavLink to={`/${locale}/admin/bankruptcy`} className={topLinkClass}>
              {t('admin.nav.bankruptcy', 'Bankruptcy listings')}
            </NavLink>
            <NavLink to={`/${locale}/admin/filings`} className={topLinkClass}>
              {t('admin.nav.filings', 'Trustee filings')}
            </NavLink>
            <NavLink to={`/${locale}/admin/flags`} className={topLinkClass}>
              {t('admin.nav.flags', 'Flag reports')}
            </NavLink>
            <NavLink to={`/${locale}/admin/news`} className={topLinkClass}>
              {t('admin.nav.news', 'News posts')}
            </NavLink>
            <NavLink to={`/${locale}/admin/media`} className={topLinkClass}>
              {t('admin.nav.media', 'Media')}
            </NavLink>
            <NavLink to={`/${locale}/admin/audit-log`} className={topLinkClass}>
              {t('admin.nav.audit', 'Audit log')}
            </NavLink>

            {/* Collections dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setCollectionsOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={collectionsOpen}
                className={
                  collectionsActive
                    ? 'inline-flex items-center rounded px-3 py-2 text-sm bg-[color:var(--color-brand)] text-white font-semibold'
                    : 'inline-flex items-center rounded px-3 py-2 text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-alt)]'
                }
              >
                {t('admin.nav.collections', 'Zbirke')}
                <span className="ml-1 text-xs">▾</span>
              </button>
              {collectionsOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-1 min-w-[14rem] z-30 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1 shadow-lg"
                >
                  {collections.map(([slug, label]) => (
                    <NavLink
                      key={slug}
                      to={`/${locale}/admin/${slug}`}
                      className={dropdownItemClass}
                      onClick={() => setCollectionsOpen(false)}
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            <NavLink to={`/${locale}/admin/globals`} className={topLinkClass}>
              {t('admin.nav.globals', 'Globals')}
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Content area — single column, full width */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
