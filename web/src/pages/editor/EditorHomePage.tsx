import { Link, useParams } from 'react-router'

export default function EditorHomePage() {
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Welcome</h2>
      <p className="text-[color:var(--color-text-muted)] mb-6">
        This area lets authorised users submit bankruptcy data by uploading a
        filled form (PDF, DOCX, or OpenDocument). The system will extract the
        fields for you to review, stamp the original file with a timestamp,
        store it in the content library, and submit a pending entry for
        administrator approval.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to={`/${locale}/editor/ingest`}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-5 hover:border-[color:var(--color-brand-gold)] transition-colors"
        >
          <h3 className="font-semibold text-[color:var(--color-heading)] mb-1">Upload &amp; extract</h3>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Drag a PDF / DOCX / ODT/ODS/ODP file. Review extracted fields. Submit.
          </p>
        </Link>
        <Link
          to={`/${locale}/editor/pending`}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-5 hover:border-[color:var(--color-brand-gold)] transition-colors"
        >
          <h3 className="font-semibold text-[color:var(--color-heading)] mb-1">My pending submissions</h3>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            See the status of submissions you made (pending review, approved, or rejected).
          </p>
        </Link>
      </div>
    </div>
  )
}
