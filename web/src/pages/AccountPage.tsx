import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'
import { getAuthToken, setAuthToken } from '@/api/client'
import { logout } from '@/api/auth'

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken()
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export default function AccountPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  usePageTitle('account')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileFlash, setProfileFlash] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNew, setConfirmNew] = useState('')
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdFlash, setPwdFlash] = useState<string | null>(null)
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
    }
  }, [user])

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[color:var(--color-text-muted)]">Loading…</p>
  if (!user) {
    navigate(`/${locale}/prijava`, { replace: true })
    return null
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileFlash(null)
    try {
      const resp = await authFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ firstName, lastName }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setProfileFlash(t('account.profileSaved', 'Profile saved.'))
    } catch (e) {
      setProfileError(String(e))
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    setPwdFlash(null)
    if (newPassword.length < 8) {
      setPwdError(t('account.minLength', 'New password must be at least 8 characters.'))
      return
    }
    if (newPassword !== confirmNew) {
      setPwdError(t('account.passwordMismatch', 'Passwords do not match.'))
      return
    }
    setPwdSaving(true)
    try {
      const resp = await authFetch('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${resp.status}`)
      }
      setPwdFlash(t('account.passwordChanged', 'Password changed. Please log in again.'))
      setCurrentPassword(''); setNewPassword(''); setConfirmNew('')
      // Force re-login by clearing token after a short delay
      setTimeout(async () => {
        await logout()
        navigate(`/${locale}/prijava`, { replace: true })
      }, 1500)
    } catch (e) {
      setPwdError(String(e))
    } finally {
      setPwdSaving(false)
    }
  }

  async function doLogout() {
    await logout()
    setAuthToken(null)
    navigate(`/${locale}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: t('nav.home', 'Home'), href: `/${locale}` },
        { label: t('account.title', 'My account') },
      ]} />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-2">
        {t('account.title', 'My account')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] mb-8">
        {t('account.signedInAs', 'Signed in as')} <span className="font-mono">{user.email}</span>
        {user.role === 'admin' && <span className="ml-2 rounded bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs">admin</span>}
      </p>

      <section className="mb-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">{t('account.profile', 'Profile')}</h2>
        {profileError && <Alert variant="error" className="mb-4">{profileError}</Alert>}
        {profileFlash && <Alert variant="info" className="mb-4">{profileFlash}</Alert>}
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acc-first" className="block text-sm font-medium mb-1">{t('auth.register.firstName', 'First name')}</label>
              <input id="acc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="acc-last" className="block text-sm font-medium mb-1">{t('auth.register.lastName', 'Last name')}</label>
              <input id="acc-last" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={profileSaving}
            className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {profileSaving ? '…' : t('account.save', 'Save')}
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">{t('account.password', 'Password')}</h2>
        {pwdError && <Alert variant="error" className="mb-4">{pwdError}</Alert>}
        {pwdFlash && <Alert variant="info" className="mb-4">{pwdFlash}</Alert>}
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label htmlFor="acc-cur" className="block text-sm font-medium mb-1">{t('account.currentPassword', 'Current password')}</label>
            <input id="acc-cur" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="acc-new" className="block text-sm font-medium mb-1">{t('account.newPassword', 'New password')}</label>
            <input id="acc-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="acc-conf" className="block text-sm font-medium mb-1">{t('account.confirmPassword', 'Confirm new password')}</label>
            <input id="acc-conf" type="password" autoComplete="new-password" value={confirmNew} onChange={(e) => setConfirmNew(e.target.value)} required
              className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={pwdSaving}
            className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pwdSaving ? '…' : t('account.changePassword', 'Change password')}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">{t('account.signOut', 'Sign out')}</h2>
        <button onClick={doLogout}
          className="rounded bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)] px-4 py-2 text-sm">
          {t('account.signOutButton', 'Sign out')}
        </button>
      </section>
    </div>
  )
}
