import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Alert } from '@/components/ui/Alert'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ApiError } from '@/api/client'
import { resetPassword } from '@/api/auth'

export default function ResetPasswordPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  usePageTitle('resetPassword')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!password || password.length < 8) {
      setError(t('auth.form.errorMinPassword', 'Password must be at least 8 characters.'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.form.errorPasswordMatch', 'Passwords do not match.'))
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      const msg = err instanceof ApiError && err.messages[0]
        ? err.messages[0]
        : t('auth.resetPassword.errorGeneric', 'Could not reset your password. Please try again.')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // No token in the URL — the link was malformed or visited directly.
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[color:var(--color-heading)] mb-2">
          {t('auth.resetPassword.title', 'Set a new password')}
        </h1>
        <Alert variant="error" className="my-6">
          {t('auth.resetPassword.missingToken', 'This reset link is missing its token. Request a new one.')}
        </Alert>
        <Link
          to={`/${locale}/prijava/zaboravljena-lozinka`}
          className="text-[color:var(--color-brand)] hover:underline font-medium"
        >
          {t('auth.resetPassword.requestNew', 'Request a new reset link')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-1 text-center">
        {t('auth.resetPassword.title', 'Set a new password')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] text-center mb-8">
        {t('auth.resetPassword.subtitle', 'Choose a new password for your account.')}
      </p>

      {done ? (
        <>
          <Alert variant="success" className="mb-6">
            {t('auth.resetPassword.done', 'Your password has been reset. You can now sign in.')}
          </Alert>
          <Link
            to={`/${locale}/prijava`}
            className="block w-full text-center rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {t('auth.resetPassword.goToLogin', 'Go to sign in')}
          </Link>
        </>
      ) : (
        <>
          {error && (
            <Alert variant="error" className="mb-6">{error}</Alert>
          )}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t('auth.resetPassword.newPassword', 'New password')}
              </label>
              <PasswordInput
                id="reset-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                disabled={submitting}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
                showLabel={t('auth.password.show', 'Show password')}
                hideLabel={t('auth.password.hide', 'Hide password')}
              />
            </div>
            <div>
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t('auth.resetPassword.confirmPassword', 'Confirm new password')}
              </label>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                disabled={submitting}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
                showLabel={t('auth.password.show', 'Show password')}
                hideLabel={t('auth.password.hide', 'Hide password')}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting
                ? t('auth.resetPassword.submitting', 'Saving…')
                : t('auth.resetPassword.submit', 'Set new password')}
            </button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-[color:var(--color-text-muted)] mt-6">
        <Link to={`/${locale}/prijava`} className="text-[color:var(--color-brand)] hover:underline font-medium">
          {t('auth.forgotPassword.backToLogin', 'Back to sign in')}
        </Link>
      </p>
    </div>
  )
}
