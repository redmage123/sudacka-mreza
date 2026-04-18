import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { useParams } from 'react-router'
import {
  CalendarDays,
  Scale,
  Gavel,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react'

type CaseType = 'civil' | 'criminal' | 'commercial' | 'administrative'
type StepTag = 'filing' | 'deadline' | 'hearing' | 'decision'

interface DeadlineStep {
  id: string
  labelKey: string
  daysOffset: number
  isHours?: boolean
  hoursValue?: number
  tag: StepTag
  legalRef: string
}

// ─── Croatian procedural deadlines (ZPP / ZKP / ZUP / ZUS) ──────────────────

const CASE_DEADLINES: Record<CaseType, DeadlineStep[]> = {
  civil: [
    { id: 'filing',         labelKey: 'deadlines.step.filing',               daysOffset: 0,   tag: 'filing',   legalRef: 'ZPP' },
    { id: 'response',       labelKey: 'deadlines.step.responseToLawsuit',     daysOffset: 15,  tag: 'deadline', legalRef: 'ZPP čl. 284' },
    { id: 'prepHearing',    labelKey: 'deadlines.step.preparatoryHearing',    daysOffset: 30,  tag: 'hearing',  legalRef: 'ZPP čl. 292' },
    { id: 'mainHearing',    labelKey: 'deadlines.step.mainHearing',           daysOffset: 90,  tag: 'hearing',  legalRef: 'ZPP čl. 299' },
    { id: 'appeal',         labelKey: 'deadlines.step.judgmentAppeal',        daysOffset: 105, tag: 'deadline', legalRef: 'ZPP čl. 353' },
    { id: 'secondInstance', labelKey: 'deadlines.step.secondInstanceDecision',daysOffset: 135, tag: 'decision', legalRef: 'ZPP čl. 369' },
  ],
  criminal: [
    { id: 'filing',         labelKey: 'deadlines.step.filing',               daysOffset: 0,   tag: 'filing',   legalRef: 'ZKP' },
    { id: 'detention',      labelKey: 'deadlines.step.policeDetentionMax',    daysOffset: 2,   isHours: true, hoursValue: 48, tag: 'deadline', legalRef: 'ZKP čl. 108' },
    { id: 'indictment',     labelKey: 'deadlines.step.indictment',           daysOffset: 180, tag: 'hearing',  legalRef: 'ZKP čl. 216' },
    { id: 'indictmentObj',  labelKey: 'deadlines.step.indictmentObjection',  daysOffset: 188, tag: 'deadline', legalRef: 'ZKP čl. 218' },
    { id: 'appeal',         labelKey: 'deadlines.step.criminalAppeal',       daysOffset: 210, tag: 'deadline', legalRef: 'ZKP čl. 464' },
  ],
  commercial: [
    { id: 'filing',         labelKey: 'deadlines.step.filing',               daysOffset: 0,  tag: 'filing',   legalRef: 'ZPP' },
    { id: 'paymentObj',     labelKey: 'deadlines.step.paymentOrderObjection', daysOffset: 8,  tag: 'deadline', legalRef: 'OZ čl. 121' },
    { id: 'response',       labelKey: 'deadlines.step.commercialResponse',   daysOffset: 30, tag: 'deadline', legalRef: 'ZPP čl. 284' },
    { id: 'hearing',        labelKey: 'deadlines.step.commercialHearing',    daysOffset: 60, tag: 'hearing',  legalRef: 'ZPP čl. 299' },
    { id: 'appeal',         labelKey: 'deadlines.step.commercialAppeal',     daysOffset: 75, tag: 'deadline', legalRef: 'ZPP čl. 353' },
  ],
  administrative: [
    { id: 'request',        labelKey: 'deadlines.step.adminRequest',         daysOffset: 0,   tag: 'filing',   legalRef: 'ZUP' },
    { id: 'adminDecision',  labelKey: 'deadlines.step.adminDecision',        daysOffset: 30,  tag: 'decision', legalRef: 'ZUP čl. 101' },
    { id: 'adminObjection', labelKey: 'deadlines.step.adminObjection',       daysOffset: 45,  tag: 'deadline', legalRef: 'ZUP čl. 122' },
    { id: 'adminSecond',    labelKey: 'deadlines.step.adminSecondInstance',  daysOffset: 75,  tag: 'decision', legalRef: 'ZUP čl. 123' },
    { id: 'adminCourt',     labelKey: 'deadlines.step.adminCourtSuit',       daysOffset: 105, tag: 'deadline', legalRef: 'ZUS čl. 24' },
  ],
}

const STATUTES: Record<CaseType, string> = {
  civil:          'deadlines.statute.civil',
  criminal:       'deadlines.statute.criminal',
  commercial:     'deadlines.statute.commercial',
  administrative: 'deadlines.statute.administrative',
}

const LEGAL_BASIS_KEYS: Record<CaseType, string> = {
  civil:          'deadlines.legalBasisCivil',
  criminal:       'deadlines.legalBasisCriminal',
  commercial:     'deadlines.legalBasisCommercial',
  administrative: 'deadlines.legalBasisAdministrative',
}

const CASE_TYPES: Array<{ value: CaseType; labelKey: string }> = [
  { value: 'civil',           labelKey: 'calculator.caseType.civil' },
  { value: 'criminal',        labelKey: 'calculator.caseType.criminal' },
  { value: 'commercial',      labelKey: 'calculator.caseType.commercial' },
  { value: 'administrative',  labelKey: 'calculator.caseType.administrative' },
]

// ─── Dot colors by step tag ───────────────────────────────────────────────────

const DOT_TAG_CLASS: Record<StepTag, string> = {
  filing:   'bg-blue-500',
  deadline: 'bg-amber-500',
  hearing:  'bg-violet-500',
  decision: 'bg-emerald-500',
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function isTodayDate(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function DeadlineCalculatorPage() {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('deadlines')

  const [caseType, setCaseType] = useState<CaseType>('civil')
  const [filingDateStr, setFilingDateStr] = useState('')

  const filingDate = useMemo<Date | null>(() => {
    if (!filingDateStr) return null
    const d = new Date(filingDateStr + 'T00:00:00')
    return isNaN(d.getTime()) ? null : d
  }, [filingDateStr])

  const steps = CASE_DEADLINES[caseType]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('deadlines.title') },
        ]}
        className="mb-6"
      />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-1">
        {t('deadlines.title')}
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-8 max-w-2xl">
        {t('deadlines.subtitle')}
      </p>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">

        {/* ── Left column: inputs + info cards ── */}
        <div className="space-y-5">

          {/* Form */}
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-6 space-y-5">
            {/* Case type */}
            <div>
              <label
                htmlFor="caseType"
                className="block text-sm font-medium text-[color:var(--color-heading)] mb-2"
              >
                {t('deadlines.selectCaseType')}
              </label>
              <select
                id="caseType"
                value={caseType}
                onChange={e => setCaseType(e.target.value as CaseType)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
              >
                {CASE_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>
                    {t(ct.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filing date */}
            <div>
              <label
                htmlFor="filingDate"
                className="block text-sm font-medium text-[color:var(--color-heading)] mb-2"
              >
                <CalendarDays className="inline w-4 h-4 mr-1 -mt-0.5 text-[color:var(--color-primary)]" />
                {t('deadlines.filingDate')}
              </label>
              <input
                id="filingDate"
                type="date"
                value={filingDateStr}
                onChange={e => setFilingDateStr(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-[color:var(--color-text)] focus:outline-2 focus:outline-[color:var(--color-border-focus)]"
              />
            </div>
          </div>

          {/* Statute of limitations */}
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--color-heading)] mb-2">
              <Clock className="w-4 h-4 text-[color:var(--color-primary)]" />
              {t('deadlines.statuteTitle')}
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
              {t(STATUTES[caseType])}
            </p>
          </div>

          {/* Legal basis */}
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-5">
            <h2 className="text-sm font-semibold text-[color:var(--color-heading)] mb-1">
              {t('deadlines.legalBasis')}
            </h2>
            <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
              {t(LEGAL_BASIS_KEYS[caseType])}
            </p>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-subtle)] p-4">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-[color:var(--color-text-muted)] leading-relaxed">
              {t('deadlines.disclaimer')}
            </p>
          </div>
        </div>

        {/* ── Right column: visual timeline ── */}
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-1">
            {t('deadlines.timelineTitle')}
          </h2>
          {filingDate && (
            <p className="text-sm text-[color:var(--color-text-muted)] mb-6">
              {t('deadlines.fromFiling')}: <span className="font-medium text-[color:var(--color-heading)]">{formatDate(filingDate, locale)}</span>
            </p>
          )}
          {!filingDate && (
            <p className="text-sm text-[color:var(--color-text-muted)] mb-6">&nbsp;</p>
          )}

          {/* Empty state */}
          {!filingDate && (
            <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-12 text-center">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-[color:var(--color-text-muted)]" />
              <p className="text-[color:var(--color-text-muted)]">
                {t('deadlines.noDeadlines')}
              </p>
            </div>
          )}

          {/* Timeline */}
          {filingDate && (
            <TimelineList steps={steps} filingDate={filingDate} locale={locale} t={t} />
          )}

          {/* Legend */}
          {filingDate && (
            <div className="mt-8 flex flex-wrap gap-4 text-xs text-[color:var(--color-text-muted)]">
              <LegendItem color="bg-blue-500"    label={t('deadlines.legend.filing')} />
              <LegendItem color="bg-amber-500"   label={t('deadlines.legend.deadline')} />
              <LegendItem color="bg-violet-500"  label={t('deadlines.legend.hearing')} />
              <LegendItem color="bg-emerald-500" label={t('deadlines.legend.decision')} />
              <LegendItem color="bg-red-500"     label={t('deadlines.legend.overdue')} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline list ────────────────────────────────────────────────────────────

interface TimelineListProps {
  steps: DeadlineStep[]
  filingDate: Date
  locale: string
  t: (key: string) => string
}

function TimelineList({ steps, filingDate, locale, t }: TimelineListProps) {
  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute left-[14px] top-4 bottom-4 w-0.5 rounded-full"
        style={{ background: 'var(--color-border)' }}
        aria-hidden="true"
      />

      <ol className="space-y-3" aria-label={t('deadlines.timelineTitle')}>
        {steps.map((step, idx) => {
          const stepDate = addDays(filingDate, step.daysOffset)
          const past     = isPast(stepDate)
          const todayStep = isTodayDate(stepDate)
          const overdue  = past && step.tag === 'deadline' && !todayStep
          const isLast   = idx === steps.length - 1

          let dotClass = DOT_TAG_CLASS[step.tag]
          if (overdue)   dotClass = 'bg-red-500'
          if (past && !overdue) dotClass = 'bg-slate-300'

          const cardClass = overdue
            ? 'border-red-200 bg-red-50'
            : todayStep
            ? 'border-blue-200 bg-blue-50'
            : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'

          const labelClass = overdue
            ? 'text-red-700'
            : 'text-[color:var(--color-heading)]'

          const dateClass = overdue
            ? 'text-red-600'
            : todayStep
            ? 'text-blue-600'
            : 'text-[color:var(--color-heading)]'

          return (
            <li key={step.id} className={`relative flex gap-5 ${isLast ? '' : 'pb-0'}`}>
              {/* Dot */}
              <div
                className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full ${dotClass}`}
                style={{ boxShadow: '0 0 0 3px var(--color-surface)' }}
                aria-hidden="true"
              >
                {overdue && <AlertTriangle className="w-3 h-3 text-white" />}
                {!overdue && past && <CheckCircle2 className="w-3 h-3 text-white" />}
                {!overdue && !past && step.tag === 'filing' && <Scale className="w-3 h-3 text-white" />}
                {!overdue && !past && step.tag === 'hearing' && <Gavel className="w-3 h-3 text-white" />}
                {!overdue && !past && step.isHours && <Clock className="w-3 h-3 text-white" />}
              </div>

              {/* Card */}
              <div className={`flex-1 min-w-0 rounded-lg border px-4 py-3 transition-colors ${cardClass}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${labelClass}`}>
                      {t(step.labelKey)}
                    </p>
                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                      {step.legalRef}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${dateClass}`}>
                      {formatDate(stepDate, locale)}
                    </p>
                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                      {step.daysOffset === 0
                        ? '—'
                        : step.isHours
                        ? `+${step.hoursValue} ${t('deadlines.hours')}`
                        : `+${step.daysOffset} ${t('deadlines.days')}`
                      }
                    </p>
                    {overdue && (
                      <p className="text-xs font-semibold text-red-600 mt-1">
                        {t('deadlines.overdue')}
                      </p>
                    )}
                    {todayStep && (
                      <p className="text-xs font-semibold text-blue-600 mt-1">
                        {t('deadlines.today')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
