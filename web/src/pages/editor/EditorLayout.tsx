import { NavLink, Outlet, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

const ALLOWED_ROLES = new Set(['admin', 'editor', 'data_editor'])

export default function EditorLayout() {
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
          {t('editor.notLoggedIn', 'Sign in required')}
        </h1>
        <p className="text-[color:var(--color-text-muted)] mb-6">
          {t('editor.notLoggedInBody', 'This area is for registered data editors.')}
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

  if (!ALLOWED_ROLES.has(user.role ?? '')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-700 mb-4">
          {t('editor.forbidden', 'Editor role required')}
        </h1>
        <p className="text-[color:var(--color-text-muted)]">
          {t('editor.forbiddenBody', 'Your account does not have data-editor permissions. Ask an administrator to grant the data_editor role.')}
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
          {t('editor.title', 'Data editor')}
        </h1>
        <span className="text-sm text-[color:var(--color-text-muted)]">
          {user.firstName} {user.lastName} · <span className="font-mono">{user.email}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2">
          <NavLink end to={`/${locale}/editor`} className={linkClass}>
            {t('editor.nav.home', 'Home')}
          </NavLink>
          <NavLink to={`/${locale}/editor/bankruptcy`} className={linkClass}>
            {t('editor.nav.filings', 'Bankruptcy filings')}
          </NavLink>
          <NavLink to={`/${locale}/editor/ingest`} className={linkClass}>
            {t('editor.nav.ingest', 'Upload & extract (legacy)')}
          </NavLink>
          <NavLink to={`/${locale}/editor/pending`} className={linkClass}>
            {t('editor.nav.pending', 'My pending submissions')}
          </NavLink>
        </nav>

        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
