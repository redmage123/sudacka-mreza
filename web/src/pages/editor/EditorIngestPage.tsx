import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getAuthToken } from '@/api/client'

type ExtractedFields = Record<string, unknown> & {
  case_number?: string | null
  debtor_name?: string | null
  debtor_oib?: string | null
  court_name?: string | null
  administrator_name?: string | null
  deadline?: string | null
  auction_date?: string | null
  value_eur?: number | null
  value_raw?: string | null
  assets_description?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  address?: string | null
  confidence?: number | null
}

// Order matters — used both for form layout and to keep extracted data stable.
const FIELDS: Array<{ key: keyof ExtractedFields; label: string; type: 'text' | 'textarea' | 'number' }> = [
  { key: 'case_number', label: 'Broj predmeta (Case number)', type: 'text' },
  { key: 'debtor_name', label: 'Stečajni dužnik (Debtor)', type: 'text' },
  { key: 'debtor_oib', label: 'OIB', type: 'text' },
  { key: 'court_name', label: 'Sud (Court)', type: 'text' },
  { key: 'administrator_name', label: 'Stečajni upravitelj (Administrator)', type: 'text' },
  { key: 'deadline', label: 'Rok (Deadline, YYYY-MM-DD)', type: 'text' },
  { key: 'auction_date', label: 'Datum dražbe (Auction date)', type: 'text' },
  { key: 'value_eur', label: 'Vrijednost — EUR (numeric)', type: 'number' },
  { key: 'value_raw', label: 'Vrijednost — raw', type: 'text' },
  { key: 'address', label: 'Adresa', type: 'text' },
  { key: 'contact_email', label: 'Kontakt email', type: 'text' },
  { key: 'contact_phone', label: 'Kontakt telefon', type: 'text' },
  { key: 'assets_description', label: 'Opis imovine (Assets description)', type: 'textarea' },
]

const ACCEPTED =
  'application/pdf,.pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,' +
  'application/vnd.oasis.opendocument.text,.odt,' +
  'application/vnd.oasis.opendocument.spreadsheet,.ods,' +
  'application/vnd.oasis.opendocument.presentation,.odp'

export default function EditorIngestPage() {
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [fields, setFields] = useState<ExtractedFields | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [mime, setMime] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)

  async function handleFile(file: File) {
    setExtracting(true)
    setError(null)
    setFlash(null)
    setFields(null)
    setFilename(file.name)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = getAuthToken()
      const resp = await fetch('/api/editor/extract', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `JWT ${token}` } : {},
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.detail ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setFields(data.fields ?? {})
      setPdfBase64(data.pdfBase64 ?? null)
      setMime(data.mime ?? null)
      setExtractedText(data.extractedText ?? null)
    } catch (e) {
      setError(String(e))
    } finally {
      setExtracting(false)
    }
  }

  async function submit() {
    if (!fields || !pdfBase64) return
    setFinalizing(true)
    setError(null)
    try {
      const token = getAuthToken()
      const fd = new FormData()
      fd.append('pdfBase64', pdfBase64)
      fd.append('fieldsJson', JSON.stringify(fields))
      const resp = await fetch('/api/editor/finalize', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `JWT ${token}` } : {},
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.detail ?? `HTTP ${resp.status}`)
      }
      const data = await resp.json()
      setFlash(`Submitted. Listing #${data.listingId} is pending admin review.`)
      setTimeout(() => navigate(`/${locale}/editor/pending`), 1500)
    } catch (e) {
      setError(String(e))
    } finally {
      setFinalizing(false)
    }
  }

  function updateField(key: keyof ExtractedFields, value: string) {
    if (!fields) return
    const fieldDef = FIELDS.find((f) => f.key === key)
    const v: unknown = fieldDef?.type === 'number' ? (value === '' ? null : Number(value)) : value
    setFields({ ...fields, [key]: v })
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-[color:var(--color-heading)]">Upload &amp; extract</h2>

      {error && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{error}</div>}
      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}

      {!fields && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            dragOver
              ? 'border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/10'
              : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)]'
          }`}
        >
          <p className="text-sm text-[color:var(--color-text-muted)] mb-3">
            Drop a file here — PDF, DOCX, or OpenDocument (.odt/.ods/.odp).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {extracting ? 'Extracting…' : 'Choose file'}
          </button>
          {filename && <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">Last: {filename}</p>}
        </div>
      )}

      {fields && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Extracted from <span className="font-mono">{filename}</span>
              {mime ? ` (${mime})` : ''}
              {typeof fields.confidence === 'number' &&
                ` · confidence ${(fields.confidence * 100).toFixed(0)}%`}
            </p>
            <button
              onClick={() => { setFields(null); setPdfBase64(null); setFilename(null); setMime(null); setExtractedText(null) }}
              className="text-xs text-[color:var(--color-brand)] hover:underline"
            >
              Start over
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3">
            {FIELDS.map((f) => {
              const value = fields[f.key]
              const common = 'w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm'
              return (
                <div key={String(f.key)}>
                  <label className="block text-sm font-medium mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea rows={4} value={value == null ? '' : String(value)} onChange={(e) => updateField(f.key, e.target.value)} className={common} />
                  ) : f.type === 'number' ? (
                    <input type="number" step="0.01" value={value == null ? '' : String(value)} onChange={(e) => updateField(f.key, e.target.value)} className={common} />
                  ) : (
                    <input type="text" value={value == null ? '' : String(value)} onChange={(e) => updateField(f.key, e.target.value)} className={common} />
                  )}
                </div>
              )
            })}

            {extractedText && (
              <details className="text-sm">
                <summary className="cursor-pointer text-[color:var(--color-brand)]">Show source text excerpt</summary>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-alt)] border border-[color:var(--color-border)] rounded p-2 max-h-64 overflow-y-auto">
                  {extractedText}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={finalizing}
                className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {finalizing ? 'Submitting…' : 'Watermark & submit'}
              </button>
              <button type="button" onClick={() => { setFields(null); setPdfBase64(null) }}
                className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
