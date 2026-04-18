import { NavLink, Outlet, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function AdminLayout() {
  const { user, loading } = useAuth()
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'

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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded px-3 py-2 text-sm ${
      isActive
        ? 'bg-[color:var(--color-brand)] text-white font-semibold'
        : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-alt)]'
    }`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]">
          {t('admin.title', 'Admin')}
        </h1>
        <span className="text-sm text-[color:var(--color-text-muted)]">
          {user.firstName} {user.lastName} · {user.email}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2">
          <NavLink end to={`/${locale}/admin`} className={linkClass}>
            {t('admin.nav.dashboard', 'Dashboard')}
          </NavLink>
          <NavLink to={`/${locale}/admin/users`} className={linkClass}>
            {t('admin.nav.users', 'Users')}
          </NavLink>
          <NavLink to={`/${locale}/admin/gdpr`} className={linkClass}>
            {t('admin.nav.gdpr', 'GDPR requests')}
          </NavLink>
          <NavLink to={`/${locale}/admin/bankruptcy`} className={linkClass}>
            {t('admin.nav.bankruptcy', 'Bankruptcy listings')}
          </NavLink>
          <NavLink to={`/${locale}/admin/filings`} className={linkClass}>
            {t('admin.nav.filings', 'Trustee filings')}
          </NavLink>
          <NavLink to={`/${locale}/admin/flags`} className={linkClass}>
            {t('admin.nav.flags', 'Flag reports')}
          </NavLink>
          <NavLink to={`/${locale}/admin/news`} className={linkClass}>
            {t('admin.nav.news', 'News posts')}
          </NavLink>
          <NavLink to={`/${locale}/admin/media`} className={linkClass}>
            {t('admin.nav.media', 'Media')}
          </NavLink>
          <NavLink to={`/${locale}/admin/audit-log`} className={linkClass}>
            {t('admin.nav.audit', 'Audit log')}
          </NavLink>

          <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('admin.nav.content', 'Content')}
          </div>
          <NavLink to={`/${locale}/admin/courts`} className={linkClass}>{t('admin.nav.courts', 'Courts')}</NavLink>
          <NavLink to={`/${locale}/admin/judges`} className={linkClass}>{t('admin.nav.judges', 'Judges')}</NavLink>
          <NavLink to={`/${locale}/admin/experts`} className={linkClass}>{t('admin.nav.experts', 'Experts')}</NavLink>
          <NavLink to={`/${locale}/admin/interpreters`} className={linkClass}>{t('admin.nav.interpreters', 'Interpreters')}</NavLink>
          <NavLink to={`/${locale}/admin/state-attorneys`} className={linkClass}>{t('admin.nav.stateAttorneys', 'State attorneys')}</NavLink>
          <NavLink to={`/${locale}/admin/bankruptcy-administrators`} className={linkClass}>{t('admin.nav.bankAdmins', 'Bankruptcy admins')}</NavLink>
          <NavLink to={`/${locale}/admin/laws`} className={linkClass}>{t('admin.nav.laws', 'Laws')}</NavLink>
          <NavLink to={`/${locale}/admin/legal-categories`} className={linkClass}>{t('admin.nav.categories', 'Categories')}</NavLink>
          <NavLink to={`/${locale}/admin/documents`} className={linkClass}>{t('admin.nav.documents', 'Documents')}</NavLink>
          <NavLink to={`/${locale}/admin/pages`} className={linkClass}>{t('admin.nav.pages', 'Pages')}</NavLink>
          <NavLink to={`/${locale}/admin/api-keys`} className={linkClass}>{t('admin.nav.apiKeys', 'API keys')}</NavLink>

          <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t('admin.nav.config', 'Configuration')}
          </div>
          <NavLink to={`/${locale}/admin/globals`} className={linkClass}>{t('admin.nav.globals', 'Globals')}</NavLink>
        </nav>

        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
