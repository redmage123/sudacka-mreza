import { Link, useParams } from 'react-router'
import { FILING_SCHEMAS, FILING_TYPE_ORDER } from './filingSchemas'

export default function BankruptcyFilingsIndex() {
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  return (
    <div>
      <h2 className="text-xl font-bold text-[color:var(--color-heading)] mb-2">Bankruptcy filings</h2>
      <p className="text-sm text-[color:var(--color-text-muted)] mb-6">
        Choose the filing you want to submit. You can either fill the form directly,
        or upload a PDF / DOCX / ODT and let the system pre-fill fields it recognises.
        Every submission gets a timestamp watermark on the uploaded source and
        is stored for admin review.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FILING_TYPE_ORDER.map((key) => {
          const s = FILING_SCHEMAS[key]
          return (
            <Link
              key={s.type}
              to={`/${locale}/editor/bankruptcy/${s.type}`}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4 hover:border-[color:var(--color-brand-gold)] transition-colors"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <h3 className="font-semibold text-[color:var(--color-heading)] text-sm">{s.title}</h3>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{s.description}</p>
            </Link>
          )
        })}
      </div>

      <p className="mt-6 text-sm">
        <Link to={`/${locale}/editor/pending`} className="text-[color:var(--color-brand)] hover:underline">
          → See the status of your past submissions
        </Link>
      </p>
    </div>
  )
}
