import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Alert } from '@/components/ui/Alert'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ApiError } from '@/api/client'
import { register } from '@/api/auth'

type UserType = 'person' | 'legal_entity'

interface FormState {
  userType: UserType
  firstName: string
  lastName: string
  email: string
  password: string
  confirm: string
  role: string                // profession (only used when userType = 'person')
  organisationName: string    // legal_entity only
  organisationOib: string     // legal_entity only
  terms: boolean
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirm?: string
  role?: string
  organisationName?: string
  organisationOib?: string
  terms?: string
}

export default function RegisterPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()
  usePageTitle('register')

  const [form, setForm] = useState<FormState>({
    userType: 'person',
    firstName: '', lastName: '', email: '', password: '', confirm: '', role: '',
    organisationName: '', organisationOib: '',
    terms: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const roles = ['lawyer', 'judge', 'researcher', 'other'] as const

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!form.firstName.trim()) errs.firstName = t('auth.form.errorRequired')
    if (!form.lastName.trim()) errs.lastName = t('auth.form.errorRequired')
    if (!form.email.trim()) errs.email = t('auth.form.errorRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('auth.form.errorEmail')
    if (!form.password) errs.password = t('auth.form.errorRequired')
    else if (form.password.length < 8) errs.password = t('auth.form.errorMinPassword')
    if (form.confirm !== form.password) errs.confirm = t('auth.form.errorPasswordMatch')
    if (form.userType === 'person') {
      if (!form.role) errs.role = t('auth.form.errorRequired')
    } else {
      if (!form.organisationName.trim()) errs.organisationName = t('auth.form.errorRequired')
      // Croatian OIB: 11 digits. Full mod-11 checksum is overkill at the form
      // layer; CMS revalidates server-side and admins can correct if needed.
      const oib = form.organisationOib.trim()
      if (!oib) errs.organisationOib = t('auth.form.errorRequired')
      else if (!/^\d{11}$/.test(oib)) errs.organisationOib = t('auth.register.errorOib', 'OIB mora imati točno 11 znamenki.')
    }
    if (!form.terms) errs.terms = t('auth.form.errorRequired')
    return errs
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      const payload: Parameters<typeof register>[0] = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      }
      if (form.userType === 'legal_entity') {
        // Server-side Users.beforeChange auto-promotes role to 'legal_entity'
        // when both organisationName and organisationOib are present at
        // self-registration; falls back to 'member' otherwise.
        payload.organisationName = form.organisationName.trim()
        payload.organisationOib = form.organisationOib.trim()
      } else {
        payload.profile = { organisation: form.role }
      }
      await register(payload)
      navigate(`/${locale}/moja-knjiznica`, { replace: true })
    } catch (err) {
      const msg = err instanceof ApiError && err.messages[0]
        ? err.messages[0]
        : t('auth.register.errorGeneric', 'Registration failed. Please try again.')
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-1 text-center">
        {t('auth.register.title')}
      </h1>
      <p className="text-sm text-[color:var(--color-text-muted)] text-center mb-8">
        {t('auth.register.subtitle')}
      </p>

      {serverError && (
        <Alert variant="error" className="mb-6">{serverError}</Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['firstName', 'lastName'] as const).map((field) => (
            <div key={field}>
              <label htmlFor={`reg-${field}`} className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t(`auth.register.${field === 'firstName' ? 'firstName' : 'lastName'}`, field === 'firstName' ? 'First name' : 'Last name')}
              </label>
              <input
                id={`reg-${field}`}
                name={field}
                type="text"
                autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                value={form[field]}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
                aria-invalid={!!errors[field]}
              />
              {errors[field] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[field]}</p>}
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
            {t('auth.register.email')}
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            disabled={submitting}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
        </div>

        {(['password', 'confirm'] as const).map((field) => (
          <div key={field}>
            <label htmlFor={`reg-${field}`} className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t(`auth.register.${field === 'confirm' ? 'confirmPassword' : 'password'}`)}
            </label>
            <PasswordInput
              id={`reg-${field}`}
              name={field}
              autoComplete="new-password"
              value={form[field]}
              onChange={handleChange}
              disabled={submitting}
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
              aria-invalid={!!errors[field]}
              showLabel={t('auth.password.show', 'Show password')}
              hideLabel={t('auth.password.hide', 'Hide password')}
            />
            {errors[field] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[field]}</p>}
          </div>
        ))}

        {/* User-type chooser (QA #7). Selecting "Pravno lice" swaps the
            profession dropdown for the org/OIB pair so legal entities can
            self-register with the data the server needs to auto-promote them
            to the `legal_entity` role. */}
        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
            {t('auth.register.userType', 'Vrsta korisnika')}
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(['person', 'legal_entity'] as const).map((ut) => (
              <label key={ut} className="flex items-center gap-2 text-sm text-[color:var(--color-text)] cursor-pointer">
                <input
                  type="radio"
                  name="userType"
                  value={ut}
                  checked={form.userType === ut}
                  onChange={handleChange}
                  disabled={submitting}
                  className="text-[color:var(--color-brand)]"
                />
                {t(`auth.register.userTypeOptions.${ut}`, ut === 'person' ? 'Osoba' : 'Pravno lice')}
              </label>
            ))}
          </div>
        </fieldset>

        {form.userType === 'person' ? (
          <div>
            <label htmlFor="reg-role" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
              {t('auth.register.role')}
            </label>
            <select
              id="reg-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              disabled={submitting}
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
              aria-invalid={!!errors.role}
            >
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r} value={r}>{t(`auth.register.roleOptions.${r}`)}</option>
              ))}
            </select>
            {errors.role && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="reg-org-name" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t('auth.register.organisationName', 'Naziv pravne osobe')}
              </label>
              <input
                id="reg-org-name"
                name="organisationName"
                type="text"
                value={form.organisationName}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
                aria-invalid={!!errors.organisationName}
              />
              {errors.organisationName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.organisationName}</p>}
            </div>
            <div>
              <label htmlFor="reg-org-oib" className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                {t('auth.register.organisationOib', 'OIB pravne osobe')}
              </label>
              <input
                id="reg-org-oib"
                name="organisationOib"
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={form.organisationOib}
                onChange={handleChange}
                disabled={submitting}
                placeholder="12345678901"
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] disabled:opacity-60"
                aria-invalid={!!errors.organisationOib}
              />
              {errors.organisationOib && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.organisationOib}</p>}
            </div>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {t(
                'auth.register.legalEntityNote',
                'Pravne osobe mogu podnositi stečajne podneske u svoje ime. Vaša ovlast bit će aktivirana nakon registracije.',
              )}
            </p>
          </div>
        )}

        <div className="flex items-start gap-3">
          <input
            id="reg-terms"
            name="terms"
            type="checkbox"
            checked={form.terms}
            onChange={handleChange}
            disabled={submitting}
            className="mt-0.5 rounded border-[color:var(--color-border)] text-[color:var(--color-brand)]"
          />
          <label htmlFor="reg-terms" className="text-sm text-[color:var(--color-text)]">
            {t('auth.register.terms')}{' '}
            <Link to={`/${locale}/uvjeti`} className="text-[color:var(--color-brand)] hover:underline">
              {t('auth.register.termsLink')}
            </Link>
          </label>
        </div>
        {errors.terms && <p className="text-xs text-red-600 dark:text-red-400">{errors.terms}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[color:var(--color-brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? t('auth.register.submitting', 'Creating account…') : t('auth.register.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-[color:var(--color-text-muted)] mt-6">
        {t('auth.register.hasAccount')}{' '}
        <Link to={`/${locale}/prijava`} className="text-[color:var(--color-brand)] hover:underline font-medium">
          {t('auth.register.login')}
        </Link>
      </p>
    </div>
  )
}
