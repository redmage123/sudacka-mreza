import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getAuthToken } from '@/api/client'
import { getSchema, type FilingField } from './filingSchemas'

function validateOib(oib: string): boolean {
  // Croatian OIB: 11 digits with a modulo-11 checksum.
  if (!/^\d{11}$/.test(oib)) return false
  let r = 10
  for (let i = 0; i < 10; i++) {
    r += Number(oib[i])
    r = r % 10 || 10
    r = (r * 2) % 11
  }
  const check = (11 - r) % 10
  return check === Number(oib[10])
}

function fieldInput(
  field: FilingField,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled: boolean,
): React.ReactElement {
  const common =
    'w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm disabled:opacity-60'
  const str = value == null ? '' : String(value)
  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          rows={field.rows ?? 4}
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={common}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          step="any"
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          className={common}
        />
      )
    case 'currency':
      return (
        <input
          type="number"
          step="0.01"
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          className={common}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={common}
        />
      )
    case 'oib':
      return (
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{11}"
          maxLength={11}
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={common}
        />
      )
    case 'select':
      return (
        <select
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={common}
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    case 'text':
    default:
      return (
        <input
          type="text"
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={common}
        />
      )
  }
}

export default function FilingFormPage() {
  const { lang, type } = useParams<{ lang: string; type: string }>()
  const locale = lang ?? 'hr'
  const navigate = useNavigate()
  const schema = type ? getSchema(type) : null
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attachmentB64, setAttachmentB64] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [preExtracting, setPreExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValues({})
    setErrors({})
    setFlash(null)
    setServerError(null)
    setAttachmentB64(null)
    setAttachmentName(null)
  }, [type])

  if (!schema) {
    return (
      <div>
        <p className="text-red-600">Unknown filing type: {type}</p>
        <button onClick={() => navigate(`/${locale}/editor/bankruptcy`)} className="mt-2 text-[color:var(--color-brand)] underline">
          Back to filings list
        </button>
      </div>
    )
  }

  async function preExtract(file: File) {
    setPreExtracting(true)
    setServerError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const token = getAuthToken()
      const resp = await fetch('/api/editor/extract', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `JWT ${token}` } : {},
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setAttachmentB64(data.pdfBase64 ?? null)
      setAttachmentName(file.name)
      // Merge any common fields the LLM found into the form.
      const fields = data.fields ?? {}
      const merged: Record<string, unknown> = { ...values }
      for (const key of Object.keys(fields)) {
        if (fields[key] != null && fields[key] !== '') merged[key] = fields[key]
      }
      setValues(merged)
    } catch (e) {
      setServerError(`Pre-fill failed: ${String(e).slice(0, 200)}`)
    } finally {
      setPreExtracting(false)
    }
  }

  function validate(): Record<string, string> {
    if (!schema) return {}
    const out: Record<string, string> = {}
    for (const f of schema.fields) {
      const v = values[f.key]
      if (f.required && (v == null || v === '')) out[f.key] = 'Obavezno / Required'
      else if (f.type === 'oib' && typeof v === 'string' && v.length > 0) {
        if (!validateOib(v)) out[f.key] = 'Invalid OIB (11 digits, checksum)'
      }
    }
    return out
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!schema) return
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    setServerError(null)
    setFlash(null)
    try {
      const token = getAuthToken()
      const resp = await fetch('/api/editor/filing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `JWT ${token}` } : {}),
        },
        body: JSON.stringify({
          filingType: schema.type,
          caseNumber: values[schema.caseField ?? 'case_number'] ?? null,
          data: values,
          attachmentBase64: attachmentB64,
          attachmentFilename: attachmentName,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.detail ?? `HTTP ${resp.status}`)
      }
      const res = await resp.json()
      setFlash(`Submitted. Filing #${res.filingId} is pending admin review.`)
      setTimeout(() => navigate(`/${locale}/editor/bankruptcy`), 1500)
    } catch (e) {
      setServerError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => navigate(`/${locale}/editor/bankruptcy`)}
        className="text-xs text-[color:var(--color-brand)] hover:underline mb-3"
      >
        ← Back to all filings
      </button>
      <h2 className="text-xl font-bold text-[color:var(--color-heading)] mb-1">{schema.icon} {schema.title}</h2>
      <p className="text-sm text-[color:var(--color-text-muted)] mb-5">{schema.description}</p>

      {serverError && <div className="mb-3 rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{serverError}</div>}
      {flash && <div className="mb-3 rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">{flash}</div>}

      <details className="mb-4 rounded border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-3 text-sm">
        <summary className="cursor-pointer text-[color:var(--color-brand)]">Pre-fill from a PDF / DOCX / ODT</summary>
        <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
          Upload a filled form — the system will run extraction and pre-populate any fields it recognises. You still confirm before submit.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.docx,.odt,.ods,.odp"
            onChange={(e) => e.target.files?.[0] && preExtract(e.target.files[0])}
          />
          {preExtracting && <span className="text-xs text-[color:var(--color-text-muted)]">Extracting…</span>}
          {attachmentName && !preExtracting && <span className="text-xs text-green-700">✓ {attachmentName}</span>}
        </div>
      </details>

      <form onSubmit={submit} className="space-y-4">
        {schema.fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`fl-${f.key}`} className="block text-sm font-medium mb-1">
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
            </label>
            {fieldInput(f, values[f.key], (v) => setValues({ ...values, [f.key]: v }), submitting)}
            {f.hint && <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{f.hint}</p>}
            {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting}
            className="rounded bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit filing'}
          </button>
          <button type="button" onClick={() => navigate(`/${locale}/editor/bankruptcy`)}
            className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
