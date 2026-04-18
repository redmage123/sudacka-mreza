import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType = 'tuzba' | 'zalba' | 'prigovor' | 'ovrsni'

interface FieldDef {
  key: string
  labelKey: string
  type: 'text' | 'textarea' | 'date' | 'number'
  required?: boolean
  rows?: number
}

type FormData = Record<string, string>

// ── Field definitions ──────────────────────────────────────────────────────────

const FIELDS: Record<DocType, FieldDef[]> = {
  tuzba: [
    { key: 'plaintiff_name',    labelKey: 'docgen.fields.plaintiff_name',    type: 'text',     required: true },
    { key: 'plaintiff_address', labelKey: 'docgen.fields.plaintiff_address', type: 'text',     required: true },
    { key: 'defendant_name',    labelKey: 'docgen.fields.defendant_name',    type: 'text',     required: true },
    { key: 'defendant_address', labelKey: 'docgen.fields.defendant_address', type: 'text',     required: true },
    { key: 'court_name',        labelKey: 'docgen.fields.court_name',        type: 'text',     required: true },
    { key: 'claim_value',       labelKey: 'docgen.fields.claim_value',       type: 'number',   required: true },
    { key: 'claim_description', labelKey: 'docgen.fields.claim_description', type: 'textarea', required: true, rows: 4 },
    { key: 'facts',             labelKey: 'docgen.fields.facts',             type: 'textarea', required: true, rows: 6 },
    { key: 'legal_basis',       labelKey: 'docgen.fields.legal_basis',       type: 'text' },
    { key: 'city',              labelKey: 'docgen.fields.city',              type: 'text',     required: true },
    { key: 'date',              labelKey: 'docgen.fields.date',              type: 'date',     required: true },
  ],
  zalba: [
    { key: 'appellant_name',    labelKey: 'docgen.fields.appellant_name',    type: 'text',     required: true },
    { key: 'appellant_address', labelKey: 'docgen.fields.appellant_address', type: 'text',     required: true },
    { key: 'court_name',        labelKey: 'docgen.fields.court_name',        type: 'text',     required: true },
    { key: 'case_number',       labelKey: 'docgen.fields.case_number',       type: 'text',     required: true },
    { key: 'judgment_date',     labelKey: 'docgen.fields.judgment_date',     type: 'date',     required: true },
    { key: 'appeal_grounds',    labelKey: 'docgen.fields.appeal_grounds',    type: 'textarea', required: true, rows: 6 },
    { key: 'appeal_request',    labelKey: 'docgen.fields.appeal_request',    type: 'textarea', required: true, rows: 3 },
    { key: 'city',              labelKey: 'docgen.fields.city',              type: 'text',     required: true },
    { key: 'date',              labelKey: 'docgen.fields.date',              type: 'date',     required: true },
  ],
  prigovor: [
    { key: 'objector_name',       labelKey: 'docgen.fields.objector_name',       type: 'text',     required: true },
    { key: 'objector_address',    labelKey: 'docgen.fields.objector_address',     type: 'text',     required: true },
    { key: 'court_name',          labelKey: 'docgen.fields.court_name',           type: 'text',     required: true },
    { key: 'case_number',         labelKey: 'docgen.fields.case_number',          type: 'text',     required: true },
    { key: 'objection_grounds',   labelKey: 'docgen.fields.objection_grounds',    type: 'textarea', required: true, rows: 6 },
    { key: 'city',                labelKey: 'docgen.fields.city',                 type: 'text',     required: true },
    { key: 'date',                labelKey: 'docgen.fields.date',                 type: 'date',     required: true },
  ],
  ovrsni: [
    { key: 'creditor_name',       labelKey: 'docgen.fields.creditor_name',        type: 'text',     required: true },
    { key: 'creditor_address',    labelKey: 'docgen.fields.creditor_address',      type: 'text',     required: true },
    { key: 'debtor_name',         labelKey: 'docgen.fields.debtor_name',           type: 'text',     required: true },
    { key: 'debtor_address',      labelKey: 'docgen.fields.debtor_address',        type: 'text',     required: true },
    { key: 'court_name',          labelKey: 'docgen.fields.court_name',            type: 'text',     required: true },
    { key: 'enforcement_title',   labelKey: 'docgen.fields.enforcement_title',     type: 'text',     required: true },
    { key: 'claim_amount',        labelKey: 'docgen.fields.claim_amount',          type: 'number',   required: true },
    { key: 'enforcement_means',   labelKey: 'docgen.fields.enforcement_means',     type: 'text' },
    { key: 'city',                labelKey: 'docgen.fields.city',                  type: 'text',     required: true },
    { key: 'date',                labelKey: 'docgen.fields.date',                  type: 'date',     required: true },
  ],
}

const DOC_ICONS: Record<DocType, string> = {
  tuzba:    '⚖️',
  zalba:    '📋',
  prigovor: '📝',
  ovrsni:   '🔨',
}

// ── Document preview component ─────────────────────────────────────────────────

function DocumentPreview({ docType, data }: { docType: DocType; data: FormData }) {
  const b = (v?: string) => v?.trim() || '_______________'

  const pageStyle: React.CSSProperties = {
    fontFamily: '"Times New Roman", Georgia, serif',
    fontSize: '11pt',
    lineHeight: '1.7',
    color: '#000000',
    background: '#ffffff',
    padding: '2.5cm 2.5cm 3cm',
    width: '21cm',
    minHeight: '29.7cm',
    boxSizing: 'border-box',
  }
  const h2Style: React.CSSProperties = {
    fontSize: '11pt',
    fontWeight: 'bold',
    marginTop: '1.4em',
    marginBottom: '0.4em',
  }
  const sigBlock: React.CSSProperties = {
    marginTop: '3em',
    textAlign: 'right',
  }
  const sigLine: React.CSSProperties = {
    marginTop: '2.5em',
    borderTop: '1px solid #000',
    display: 'inline-block',
    minWidth: '220px',
    paddingTop: '0.5em',
    fontSize: '10pt',
  }

  if (docType === 'tuzba') {
    const claimFormatted = data.claim_value
      ? `${parseFloat(data.claim_value).toLocaleString('hr-HR')} EUR`
      : b(undefined)
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'right', marginBottom: '2em' }}>
          <div>{b(data.plaintiff_name)}</div>
          <div>{b(data.plaintiff_address)}</div>
        </div>
        <div style={{ marginBottom: '2em' }}>
          <strong>{b(data.court_name)}</strong>
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2em 0 1.5em' }}>
          TUŽBA
        </h1>
        <p><strong>TUŽITELJ:</strong>&nbsp;{b(data.plaintiff_name)}, {b(data.plaintiff_address)}</p>
        <p><strong>TUŽENIK:</strong>&nbsp;{b(data.defendant_name)}, {b(data.defendant_address)}</p>
        <p><strong>Vrijednost predmeta spora:</strong>&nbsp;{claimFormatted}</p>
        <div style={h2Style}>TUŽBENI ZAHTJEV</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{b(data.claim_description)}</p>
        <div style={h2Style}>OBRAZLOŽENJE</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{b(data.facts)}</p>
        {data.legal_basis && (
          <>
            <div style={h2Style}>PRAVNA OSNOVA</div>
            <p>{data.legal_basis}</p>
          </>
        )}
        <div style={sigBlock}>
          <p>{b(data.city)}, {b(data.date)}</p>
          <div style={sigLine}>Tužitelj / Punomoćnik</div>
        </div>
      </div>
    )
  }

  if (docType === 'zalba') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'right', marginBottom: '2em' }}>
          <div>{b(data.appellant_name)}</div>
          <div>{b(data.appellant_address)}</div>
        </div>
        <div style={{ marginBottom: '1em' }}>
          <strong>{b(data.court_name)}</strong>
        </div>
        <div style={{ marginBottom: '2em' }}>
          Predmet br.: {b(data.case_number)}
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2em 0 1.5em' }}>
          ŽALBA
        </h1>
        <p><strong>ŽALITELJ:</strong>&nbsp;{b(data.appellant_name)}, {b(data.appellant_address)}</p>
        <p>protiv presude/rješenja od: <strong>{b(data.judgment_date)}</strong>, predmet br. {b(data.case_number)}</p>
        <div style={h2Style}>RAZLOZI ŽALBE</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{b(data.appeal_grounds)}</p>
        <div style={h2Style}>ŽALBENI ZAHTJEV</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{b(data.appeal_request)}</p>
        <div style={sigBlock}>
          <p>{b(data.city)}, {b(data.date)}</p>
          <div style={sigLine}>Žalitelj / Punomoćnik</div>
        </div>
      </div>
    )
  }

  if (docType === 'prigovor') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'right', marginBottom: '2em' }}>
          <div>{b(data.objector_name)}</div>
          <div>{b(data.objector_address)}</div>
        </div>
        <div style={{ marginBottom: '1em' }}>
          <strong>{b(data.court_name)}</strong>
        </div>
        <div style={{ marginBottom: '2em' }}>
          Predmet br.: {b(data.case_number)}
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2em 0 1.5em' }}>
          PRIGOVOR
        </h1>
        <p><strong>PODNOSITELJ PRIGOVORA:</strong>&nbsp;{b(data.objector_name)}, {b(data.objector_address)}</p>
        <p>Predmet prigovora: rješenje br. {b(data.case_number)}</p>
        <div style={h2Style}>RAZLOZI PRIGOVORA</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{b(data.objection_grounds)}</p>
        <div style={h2Style}>ZAHTJEV</div>
        <p>Na temelju navedenih razloga, podnositelj prigovora predlaže sudu da prigovor usvoji i pobijano rješenje ukine.</p>
        <div style={sigBlock}>
          <p>{b(data.city)}, {b(data.date)}</p>
          <div style={sigLine}>Podnositelj prigovora / Punomoćnik</div>
        </div>
      </div>
    )
  }

  // ovrsni
  const amountFormatted = data.claim_amount
    ? `${parseFloat(data.claim_amount).toLocaleString('hr-HR')} EUR`
    : b(undefined)
  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'right', marginBottom: '2em' }}>
        <div>{b(data.creditor_name)}</div>
        <div>{b(data.creditor_address)}</div>
      </div>
      <div style={{ marginBottom: '2em' }}>
        <strong>{b(data.court_name)}</strong>
      </div>
      <h1 style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2em 0 1.5em' }}>
        OVRŠNI PRIJEDLOG
      </h1>
      <p><strong>OVRHOVODITELJ:</strong>&nbsp;{b(data.creditor_name)}, {b(data.creditor_address)}</p>
      <p><strong>OVRŠENIK:</strong>&nbsp;{b(data.debtor_name)}, {b(data.debtor_address)}</p>
      <div style={h2Style}>OVRŠNA ISPRAVA</div>
      <p>{b(data.enforcement_title)}</p>
      <div style={h2Style}>TRAŽBINA</div>
      <p>Iznos tražbine: <strong>{amountFormatted}</strong></p>
      {data.enforcement_means && (
        <>
          <div style={h2Style}>SREDSTVO OVRHE</div>
          <p>{data.enforcement_means}</p>
        </>
      )}
      <div style={h2Style}>PRIJEDLOG</div>
      <p>
        Na temelju navedene ovršne isprave, ovrhovoditelj predlaže sudu da donese rješenje o ovrsi
        i odredi ovrhu radi namirenja navedene tražbine.
      </p>
      <div style={sigBlock}>
        <p>{b(data.city)}, {b(data.date)}</p>
        <div style={sigLine}>Ovrhovoditelj / Punomoćnik</div>
      </div>
    </div>
  )
}

// ── PDF generation ─────────────────────────────────────────────────────────────

async function generatePdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const imgH = (canvas.height * pageW) / canvas.width

  let y = 0
  let remaining = imgH

  while (remaining > 0) {
    doc.addImage(imgData, 'PNG', 0, -y, pageW, imgH)
    remaining -= pageH
    y += pageH
    if (remaining > 0) doc.addPage()
  }

  doc.save(filename)
}

// ── Type selector card ─────────────────────────────────────────────────────────

function TypeCard({
  type,
  icon,
  title,
  desc,
  onSelect,
}: {
  type: DocType
  icon: string
  title: string
  desc: string
  onSelect: (t: DocType) => void
}) {
  return (
    <button
      onClick={() => onSelect(type)}
      className="flex flex-col items-start gap-3 rounded-2xl border-2 border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-left hover:border-[color:var(--color-brand-navy)] hover:bg-[color:var(--color-surface-subtle)] transition-all group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)]"
      aria-label={title}
    >
      <span className="text-4xl">{icon}</span>
      <div>
        <p className="font-semibold text-[color:var(--color-heading)] text-lg group-hover:text-[color:var(--color-brand-navy)]">{title}</p>
        <p className="text-sm text-[color:var(--color-text-muted)] mt-1">{desc}</p>
      </div>
      <span className="mt-auto text-sm font-medium text-[color:var(--color-brand-navy)] opacity-0 group-hover:opacity-100 transition-opacity">
        Odaberi →
      </span>
    </button>
  )
}

// ── Form field renderer ────────────────────────────────────────────────────────

function FormField({
  field,
  value,
  error,
  label,
  onChange,
}: {
  field: FieldDef
  value: string
  error?: string
  label: string
  onChange: (key: string, val: string) => void
}) {
  const inputCls = [
    'w-full rounded-lg border px-3 py-2 text-sm bg-[color:var(--color-surface)] text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)]',
    'focus:outline-none focus:ring-2 focus:ring-[color:var(--color-border-focus)] focus:border-transparent transition-colors',
    error
      ? 'border-[color:var(--color-error)]'
      : 'border-[color:var(--color-border)] hover:border-[color:var(--color-text-muted)]',
  ].join(' ')

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[color:var(--color-text)]">
        {label}
        {field.required && <span className="text-[color:var(--color-error)] ml-1">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          rows={field.rows ?? 4}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-invalid={!!error}
          className={inputCls + ' resize-y'}
        />
      ) : (
        <input
          type={field.type}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-invalid={!!error}
          className={inputCls}
        />
      )}
      {error && (
        <p className="text-xs text-[color:var(--color-error)] mt-0.5" role="alert">{error}</p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DocumentGeneratorPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('docgen')

  const [docType, setDocType] = useState<DocType | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const handleFieldChange = useCallback((key: string, val: string) => {
    setFormData((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    if (!docType) return false
    const newErrors: Record<string, string> = {}
    for (const field of FIELDS[docType]) {
      if (field.required && !formData[field.key]?.trim()) {
        newErrors[field.key] = t('docgen.required')
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [docType, formData, t])

  const handleGenerate = useCallback(async () => {
    if (!validate()) return
    if (!previewRef.current || !docType) return
    setGenerating(true)
    try {
      const docTitles: Record<DocType, string> = {
        tuzba:    'tuzba',
        zalba:    'zalba',
        prigovor: 'prigovor',
        ovrsni:   'ovrsni-prijedlog',
      }
      const dateStr = formData.date ?? new Date().toISOString().split('T')[0]
      const filename = `${docTitles[docType]}-${dateStr}.pdf`
      await generatePdf(previewRef.current, filename)
    } finally {
      setGenerating(false)
    }
  }, [validate, docType, formData])

  const handleReset = () => {
    setDocType(null)
    setFormData({})
    setErrors({})
  }

  const docTypes: DocType[] = ['tuzba', 'zalba', 'prigovor', 'ovrsni']

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'),      href: `/${locale}` },
          { label: tn('documents'), href: `/${locale}/dokumenti` },
          { label: t('docgen.title') },
        ]}
      />

      <div className="mt-6 mb-8">
        <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]">
          {t('docgen.title')}
        </h1>
        <p className="text-[color:var(--color-text-muted)] mt-2">{t('docgen.subtitle')}</p>
      </div>

      {/* ── Step 1: type selector ── */}
      {!docType && (
        <>
          <p className="font-medium text-[color:var(--color-text)] mb-4">{t('docgen.selectType')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {docTypes.map((type) => (
              <TypeCard
                key={type}
                type={type}
                icon={DOC_ICONS[type]}
                title={t(`docgen.type.${type}`)}
                desc={t(`docgen.type.${type}.desc`)}
                onSelect={setDocType}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Step 2: form + preview ── */}
      {docType && (
        <div className="flex flex-col xl:flex-row gap-8">

          {/* Left: form */}
          <div className="xl:w-96 flex-shrink-0">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleReset}
                className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors"
              >
                ← {t('docgen.nav.back')}
              </button>
              <span className="text-2xl">{DOC_ICONS[docType]}</span>
              <h2 className="text-xl font-semibold text-[color:var(--color-heading)]">
                {t(`docgen.type.${docType}`)}
              </h2>
            </div>

            <div className="space-y-4">
              {FIELDS[docType].map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={formData[field.key] ?? ''}
                  error={errors[field.key]}
                  label={t(field.labelKey)}
                  onChange={handleFieldChange}
                />
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="primary"
                size="lg"
                loading={generating}
                onClick={handleGenerate}
                className="flex-1"
              >
                {generating ? t('docgen.generating') : t('docgen.generate')}
              </Button>
              <Button variant="secondary" size="lg" onClick={handleReset}>
                {t('docgen.reset')}
              </Button>
            </div>

            <p className="text-xs text-[color:var(--color-text-muted)] mt-4 leading-relaxed">
              ⚠️ {t('docgen.disclaimer')}
            </p>
          </div>

          {/* Right: live preview */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[color:var(--color-text-muted)] mb-3 uppercase tracking-wider">
              Pregled dokumenta
            </p>
            <div
              className="overflow-auto rounded-xl border border-[color:var(--color-border)] shadow-sm bg-white"
              style={{ maxHeight: '80vh' }}
            >
              <div
                ref={previewRef}
                style={{ transformOrigin: 'top left' }}
              >
                <DocumentPreview docType={docType} data={formData} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      {docType && (
        <div className="mt-8 pt-6 border-t border-[color:var(--color-border)]">
          <Link
            to={`/${locale}/dokumenti`}
            className="text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors"
          >
            ← {t('docgen.nav.back')}
          </Link>
        </div>
      )}
    </div>
  )
}
