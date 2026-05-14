import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Alert } from '@/components/ui/Alert'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ApiError } from '@/api/client'
import { login, verifyMfa } from '@/api/auth'

interface FormErrors {
  identifier?: string
  password?: string
  mfa?: string
}

export default function LoginPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()
  usePageTitle('login')

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // MFA second-step state. When set, the form switches to the OTP entry
  // view and stops accepting password input. The challenge is opaque to the
  // client; the server validates it on /users/auth/verify-mfa.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null)
  const [mfaEmailHint, setMfaEmailHint] = useState<string>('')
  const [mfaCode, setMfaCode] = useState('')

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!identifier.trim()) errs.identifier = t('auth.form.errorRequired')
    if (!password.trim()) errs.password = t('auth.form.errorRequired')
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      const result = await login(identifier, password)
      if (result.kind === 'mfa') {
        setMfaChallenge(result.challenge)
        setMfaEmailHint(result.emailHint)
        return
      }
      navigate(`/${locale}/moja-knjiznica`, { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError && err.messages[0]
        ? err.messages[0]
        : t('auth.login.errorGeneric', 'Login failed. Please try again.')
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!mfaChallenge) return
    if (!mfaCode.trim()) {
      setErrors((p) => ({ ...p, mfa: t('auth.form.errorRequired') }))
      return
    }
    setSubmitting(true)
    try {
      await verifyMfa(mfaChallenge, mfaCode)
      navigate(`/${locale}/moja-knjiznica`, { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError && err.messages[0]
        ? err.messages[0]
        : t('auth.login.errorGeneric', 'Login failed. Please try again.')
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-1 text-center">
        {t('auth.login.title')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] text-center mb-8">
        {t('auth.login.subtitle')}
      </p>

      {serverError && (
        <Alert variant="error" className="mb-6">{serverError}</Alert>
      )}

      {mfaChallenge ? (
        <form onSubmit={handleMfaSubmit} noValidate className="space-y-4">
          <p className="text-sm text-[color:var(--color-text-muted)] mb-2">
            {t('auth.login.mfaPrompt', 'Enter the 6-digit code we just emailed to')}{' '}
            <span className="font-mono">{mfaEmailHint || t('auth.login.mfaEmailFallback', 'your address')}</span>.
          </p>
          <div>
            <label htmlFor="login-mfa" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('auth.login.mfaLabel', 'Login code')}
            </label>
            <input
              id="login-mfa"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => { setMfaCode(e.target.value.replace(/\s+/g, '')); setErrors((p) => ({ ...p, mfa: undefined })) }}
              disabled={submitting}
              autoFocus
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
              aria-invalid={!!errors.mfa}
              aria-label={t('auth.login.mfaLabel', 'Login code')}
            />
            {errors.mfa && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.mfa}</p>}
          </div>
          <button
            type="submit"
            disabled={submitting || mfaCode.length < 6}
            className="w-full rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? t('auth.login.submitting', 'Signing in…') : t('auth.login.mfaSubmit', 'Verify code')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => { setMfaChallenge(null); setMfaCode(''); setServerError(null) }}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-6 py-2.5 text-sm font-medium text-[color:var(--color-text)] hover:border-[color:var(--color-brand)] transition-colors disabled:opacity-60"
          >
            {t('auth.login.mfaCancel', 'Use a different account')}
          </button>
        </form>
      ) : (
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
            {t('auth.login.email')}
          </label>
          <input
            id="login-email"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setErrors((p) => ({ ...p, identifier: undefined })) }}
            disabled={submitting}
            placeholder={t('auth.login.emailOrUsername', 'Email or username')}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
            aria-invalid={!!errors.identifier}
          />
          {errors.identifier && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.identifier}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="block text-sm font-medium text-[color:var(--color-text)]">
              {t('auth.login.password')}
            </label>
            <Link to={`/${locale}/prijava/zaboravljena-lozinka`} className="text-xs text-[color:var(--color-brand)] hover:underline">
              {t('auth.login.forgotPassword')}
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
            disabled={submitting}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
            aria-invalid={!!errors.password}
            showLabel={t('auth.password.show', 'Show password')}
            hideLabel={t('auth.password.hide', 'Hide password')}
          />
          {errors.password && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? t('auth.login.submitting', 'Signing in…') : t('auth.login.submit')}
        </button>
      </form>
      )}

      <p className="text-center text-sm text-[color:var(--color-text-muted)] mt-6">
        {t('auth.login.noAccount')}{' '}
        <Link to={`/${locale}/registracija`} className="text-[color:var(--color-brand)] hover:underline font-medium">
          {t('auth.login.register')}
        </Link>
      </p>
    </div>
  )
}
