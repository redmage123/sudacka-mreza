import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Alert } from '@/components/ui/Alert'

interface FormState {
  name: string
  email: string
  subject: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

function validate(form: FormState, t: (k: string) => string): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = t('contact.form.errorRequired')
  if (!form.email.trim()) errors.email = t('contact.form.errorRequired')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = t('contact.form.errorEmail')
  if (!form.subject.trim()) errors.subject = t('contact.form.errorRequired')
  if (!form.message.trim()) errors.message = t('contact.form.errorRequired')
  else if (form.message.trim().length < 20) errors.message = t('contact.form.errorMinLength')
  return errors
}

export default function ContactPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('contact')

  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form, t)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSending(true)
    // Simulate send — no real backend yet
    setTimeout(() => {
      setSending(false)
      setSubmitted(true)
      setForm({ name: '', email: '', subject: '', message: '' })
    }, 800)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('contact') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        {t('contact.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">{t('contact.subtitle')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form */}
        <div className="lg:col-span-2">
          {submitted && (
            <Alert variant="success" className="mb-6">
              {t('contact.form.success')}
            </Alert>
          )}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {(['name', 'email', 'subject'] as const).map((field) => (
              <div key={field}>
                <label
                  htmlFor={`contact-${field}`}
                  className="block text-sm font-medium text-[color:var(--color-text)] mb-1"
                >
                  {t(`contact.form.${field}`)}
                </label>
                <input
                  id={`contact-${field}`}
                  name={field}
                  type={field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] aria-invalid:border-red-500"
                  aria-invalid={!!errors[field]}
                />
                {errors[field] && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[field]}</p>
                )}
              </div>
            ))}

            <div>
              <label
                htmlFor="contact-message"
                className="block text-sm font-medium text-[color:var(--color-text)] mb-1"
              >
                {t('contact.form.message')}
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder={t('contact.form.messagePlaceholder')}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)] resize-y aria-invalid:border-red-500"
                aria-invalid={!!errors.message}
              />
              {errors.message && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-brand)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {sending ? t('contact.form.sending') : t('contact.form.send')}
            </button>
          </form>
        </div>

        {/* Org info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <h2 className="text-base font-semibold text-[color:var(--color-heading)] mb-3">
              {t('contact.org.title')}
            </h2>
            <p className="text-sm text-[color:var(--color-text)] font-semibold mb-1">Sudačka Mreža</p>
            <p className="text-sm text-[color:var(--color-text-muted)] mb-1">{t('contact.org.address')}</p>
            <a
              href={`mailto:${t('contact.org.email')}`}
              className="text-sm text-[color:var(--color-brand)] hover:underline"
            >
              {t('contact.org.email')}
            </a>
          </div>

          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            <h2 className="text-base font-semibold text-[color:var(--color-heading)] mb-3">
              {t('contact.social.title')}
            </h2>
            <div className="flex gap-3">
              {['LinkedIn', 'Twitter/X', 'Facebook'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-xs rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:border-[color:var(--color-brand)] transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
