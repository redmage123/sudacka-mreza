import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Alert } from '@/components/ui/Alert'
import { requestPasswordReset } from '@/api/auth'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('forgotPassword')

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError(t('auth.form.errorRequired', 'This field is required.'))
      return
    }
    setSubmitting(true)
    try {
      // The server always answers 200 (it never discloses whether the address
      // exists), so a resolved promise just means the request was accepted.
      await requestPasswordReset(email, locale)
      setSent(true)
    } catch {
      // Network/unexpected error only — keep the message generic.
      setError(t('auth.forgotPassword.errorGeneric', 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-1 text-center">
        {t('auth.forgotPassword.title', 'Reset your password')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] text-center mb-8">
        {t('auth.forgotPassword.subtitle', 'Enter your email and we will send you a link to set a new password.')}
      </p>

      {sent ? (
        <Alert variant="success" className="mb-6">
          {t(
            'auth.forgotPassword.sent',
            'If that email is registered, a reset link is on its way. Check your inbox (and spam folder).',
          )}
        </Alert>
      ) : (
        <>
          {error && (
            <Alert variant="error" className="mb-6">{error}</Alert>
          )}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t('auth.login.email', 'Email')}
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                disabled={submitting}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting
                ? t('auth.forgotPassword.submitting', 'Sending…')
                : t('auth.forgotPassword.submit', 'Send reset link')}
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
