import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet-async'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Cell,
} from 'recharts'

// ─── Design-system palette ────────────────────────────────────────────────────
const NAVY = '#0D2B55'
const GOLD = '#C8941A'
const GREEN = '#16A34A'
const RED = '#DC2626'
const CHART_PALETTE = [NAVY, GOLD, GREEN, '#7C3AED']

// ─── Mock data ────────────────────────────────────────────────────────────────

type CourtType = 'municipal' | 'county' | 'commercial' | 'misdemeanour'

interface CourtStat {
  id: string
  name: string
  type: CourtType
  clearanceRate: number   // percentage 0-100
  backlog: number         // pending cases
  avgDuration: number     // days
  casesFiled: number
  casesResolved: number
}

interface MonthlyTrendPoint {
  month: string
  municipal: number
  county: number
  commercial: number
  misdemeanour: number
}

const COURTS: CourtStat[] = [
  // Municipal
  { id: 'os-zg',     name: 'Općinski sud u Zagrebu',     type: 'municipal',     clearanceRate: 94, backlog: 2840, avgDuration: 180, casesFiled: 18400, casesResolved: 17296 },
  { id: 'os-st',     name: 'Općinski sud u Splitu',      type: 'municipal',     clearanceRate: 87, backlog: 1520, avgDuration: 210, casesFiled: 9200,  casesResolved: 8004 },
  { id: 'os-ri',     name: 'Općinski sud u Rijeci',      type: 'municipal',     clearanceRate: 91, backlog: 890,  avgDuration: 165, casesFiled: 7600,  casesResolved: 6916 },
  { id: 'os-os',     name: 'Općinski sud u Osijeku',     type: 'municipal',     clearanceRate: 85, backlog: 1100, avgDuration: 225, casesFiled: 6800,  casesResolved: 5780 },
  { id: 'os-zd',     name: 'Općinski sud u Zadru',       type: 'municipal',     clearanceRate: 89, backlog: 620,  avgDuration: 190, casesFiled: 5200,  casesResolved: 4628 },
  // County
  { id: 'zs-zg',     name: 'Županijski sud u Zagrebu',   type: 'county',        clearanceRate: 92, backlog: 680,  avgDuration: 310, casesFiled: 4800,  casesResolved: 4416 },
  { id: 'zs-st',     name: 'Županijski sud u Splitu',    type: 'county',        clearanceRate: 88, backlog: 420,  avgDuration: 340, casesFiled: 3200,  casesResolved: 2816 },
  { id: 'zs-ri',     name: 'Županijski sud u Rijeci',    type: 'county',        clearanceRate: 90, backlog: 310,  avgDuration: 295, casesFiled: 2900,  casesResolved: 2610 },
  // Commercial
  { id: 'ts-zg',     name: 'Trgovački sud u Zagrebu',    type: 'commercial',    clearanceRate: 96, backlog: 1240, avgDuration: 145, casesFiled: 14200, casesResolved: 13632 },
  { id: 'vts',       name: 'Visoki trgovački sud',       type: 'commercial',    clearanceRate: 93, backlog: 380,  avgDuration: 220, casesFiled: 3800,  casesResolved: 3534 },
  { id: 'ts-st',     name: 'Trgovački sud u Splitu',     type: 'commercial',    clearanceRate: 91, backlog: 540,  avgDuration: 160, casesFiled: 5600,  casesResolved: 5096 },
  // Misdemeanour
  { id: 'ps-zg',     name: 'Prekršajni sud u Zagrebu',   type: 'misdemeanour',  clearanceRate: 98, backlog: 3200, avgDuration: 45,  casesFiled: 42000, casesResolved: 41160 },
  { id: 'ps-st',     name: 'Prekršajni sud u Splitu',    type: 'misdemeanour',  clearanceRate: 96, backlog: 1100, avgDuration: 52,  casesFiled: 18000, casesResolved: 17280 },
  { id: 'ps-ri',     name: 'Prekršajni sud u Rijeci',    type: 'misdemeanour',  clearanceRate: 95, backlog: 780,  avgDuration: 48,  casesFiled: 14200, casesResolved: 13490 },
  { id: 'ps-os',     name: 'Prekršajni sud u Osijeku',   type: 'misdemeanour',  clearanceRate: 94, backlog: 650,  avgDuration: 55,  casesFiled: 11000, casesResolved: 10340 },
]

const MONTHLY_TREND: MonthlyTrendPoint[] = [
  { month: '01/24', municipal: 195, county: 330, commercial: 155, misdemeanour: 50 },
  { month: '02/24', municipal: 192, county: 325, commercial: 152, misdemeanour: 49 },
  { month: '03/24', municipal: 188, county: 320, commercial: 148, misdemeanour: 48 },
  { month: '04/24', municipal: 185, county: 315, commercial: 145, misdemeanour: 47 },
  { month: '05/24', municipal: 180, county: 310, commercial: 142, misdemeanour: 46 },
  { month: '06/24', municipal: 178, county: 305, commercial: 140, misdemeanour: 45 },
  { month: '07/24', municipal: 175, county: 300, commercial: 138, misdemeanour: 44 },
  { month: '08/24', municipal: 178, county: 305, commercial: 140, misdemeanour: 45 },
  { month: '09/24', municipal: 182, county: 310, commercial: 143, misdemeanour: 46 },
  { month: '10/24', municipal: 185, county: 315, commercial: 146, misdemeanour: 47 },
  { month: '11/24', municipal: 188, county: 320, commercial: 149, misdemeanour: 48 },
  { month: '12/24', municipal: 192, county: 325, commercial: 152, misdemeanour: 49 },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string
  value: number | string
  unit?: string
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border p-5 flex flex-col gap-1',
        accent
          ? 'bg-[color:var(--color-brand-navy)] border-[color:var(--color-brand-navy)] text-white'
          : 'bg-[color:var(--color-surface)] border-[color:var(--color-border)]',
      ].join(' ')}
    >
      <p className={`text-3xl font-bold ${accent ? 'text-[color:var(--color-brand-gold-light)]' : 'text-[color:var(--color-heading)]'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-lg font-normal ml-1">{unit}</span>}
      </p>
      <p className={`text-sm ${accent ? 'text-white/70' : 'text-[color:var(--color-text-muted)]'}`}>
        {label}
      </p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4 border-b border-[color:var(--color-border)] pb-2">
        {title}
      </h2>
      {children}
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg px-3 py-2 text-sm text-[color:var(--color-text)]">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
          {p.unit ? ` ${p.unit}` : ''}
        </p>
      ))}
    </div>
  )
}

// ─── Chart sub-components ─────────────────────────────────────────────────────

function ClearanceRateChart({ courts }: { courts: CourtStat[] }) {
  const { t } = useTranslation('common')
  const sorted = [...courts].sort((a, b) => b.clearanceRate - a.clearanceRate)
  const shorten = (s: string) => s.length > 26 ? s.slice(0, 24) + '…' : s
  const label = t('courtPerformance.chart.clearanceRateSeries')

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, sorted.length * 36)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12 }}
          stroke="var(--color-text-muted)"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickFormatter={shorten}
          tick={{ fontSize: 11 }}
          stroke="var(--color-text-muted)"
        />
        <Tooltip
          content={<CustomTooltip />}
          formatter={(v: number) => [`${v}%`, label]}
        />
        <ReferenceLine x={90} stroke={GOLD} strokeDasharray="4 3" label={{ value: '90%', position: 'top', fontSize: 11, fill: GOLD }} />
        <Bar dataKey="clearanceRate" name={label} radius={[0, 4, 4, 0]}>
          {sorted.map((c) => (
            <Cell key={c.id} fill={c.clearanceRate >= 90 ? GREEN : c.clearanceRate >= 80 ? GOLD : RED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function BacklogChart({ courts }: { courts: CourtStat[] }) {
  const { t } = useTranslation('common')
  const sorted = [...courts].sort((a, b) => b.backlog - a.backlog).slice(0, 12)
  const shorten = (s: string) => s.length > 26 ? s.slice(0, 24) + '…' : s
  const label = t('courtPerformance.chart.backlogSeries')

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, sorted.length * 36)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickFormatter={shorten}
          tick={{ fontSize: 11 }}
          stroke="var(--color-text-muted)"
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="backlog" name={label} radius={[0, 4, 4, 0]}>
          {sorted.map((c, i) => (
            <Cell key={c.id} fill={i % 2 === 0 ? NAVY : '#1A3F72'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DurationTrendChart() {
  const { t } = useTranslation('common')
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={MONTHLY_TREND} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" />
        <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" allowDecimals={false} unit={` ${t('courtPerformance.days')}`} width={60} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {(['municipal', 'county', 'commercial', 'misdemeanour'] as CourtType[]).map((type, i) => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            name={t(`courtPerformance.type.${type}`)}
            stroke={CHART_PALETTE[i]}
            strokeWidth={2}
            dot={{ r: 2.5, fill: CHART_PALETTE[i] }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function PerformanceTable({ courts }: { courts: CourtStat[] }) {
  const { t } = useTranslation('common')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={t('courtPerformance.table.ariaLabel')}>
        <thead>
          <tr className="border-b border-[color:var(--color-border)]">
            {['court', 'type', 'clearance', 'backlog', 'avgDuration'].map((col) => (
              <th
                key={col}
                className="py-2 px-3 text-left font-semibold text-[color:var(--color-text-muted)] whitespace-nowrap"
              >
                {t(`courtPerformance.table.${col}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courts.map((c) => {
            const clearanceColor = c.clearanceRate >= 90 ? 'text-[color:var(--color-success)]' : c.clearanceRate >= 80 ? 'text-[color:var(--color-warning)]' : 'text-[color:var(--color-error)]'
            return (
              <tr
                key={c.id}
                className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-subtle)] transition-colors"
              >
                <td className="py-2.5 px-3 font-medium text-[color:var(--color-text)]">{c.name}</td>
                <td className="py-2.5 px-3 text-[color:var(--color-text-muted)]">
                  {t(`courtPerformance.type.${c.type}`)}
                </td>
                <td className={`py-2.5 px-3 font-semibold tabular-nums ${clearanceColor}`}>
                  {c.clearanceRate}%
                </td>
                <td className="py-2.5 px-3 text-[color:var(--color-heading)] tabular-nums">
                  {c.backlog.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-[color:var(--color-text-muted)] tabular-nums">
                  {c.avgDuration} {t('courtPerformance.days')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | CourtType

export default function CourtPerformancePage() {
  const { t } = useTranslation('common')
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = useMemo(
    () => filter === 'all' ? COURTS : COURTS.filter((c) => c.type === filter),
    [filter],
  )

  const avgClearance = useMemo(
    () => Math.round(filtered.reduce((s, c) => s + c.clearanceRate, 0) / filtered.length),
    [filtered],
  )

  const avgDuration = useMemo(
    () => Math.round(filtered.reduce((s, c) => s + c.avgDuration, 0) / filtered.length),
    [filtered],
  )

  const totalBacklog = useMemo(
    () => filtered.reduce((s, c) => s + c.backlog, 0),
    [filtered],
  )

  const filterOptions: { value: FilterType; labelKey: string }[] = [
    { value: 'all',          labelKey: 'courtPerformance.filterAll' },
    { value: 'municipal',    labelKey: 'courtPerformance.filterMunicipal' },
    { value: 'county',       labelKey: 'courtPerformance.filterCounty' },
    { value: 'commercial',   labelKey: 'courtPerformance.filterCommercial' },
    { value: 'misdemeanour', labelKey: 'courtPerformance.filterMisdemeanour' },
  ]

  return (
    <>
      <Helmet>
        <title>{t('courtPerformance.title')} — Sudačka Mreža</title>
        <meta name="description" content={t('courtPerformance.description')} />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ── Page header ───────────────────────────────────────── */}
        <div className="border-b border-[color:var(--color-border)] pb-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">
              {t('courtPerformance.title')}
            </h1>
            <p className="text-[color:var(--color-text-muted)]">
              {t('courtPerformance.description')}
            </p>
          </div>

          {/* ── Filter ──────────────────────────────────────────── */}
          <div className="shrink-0">
            <label htmlFor="court-type-filter" className="sr-only">
              {t('courtPerformance.filterAll')}
            </label>
            <select
              id="court-type-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-border-focus)]"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Metric cards ──────────────────────────────────────── */}
        <section aria-label="KPI">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label={t('courtPerformance.metric.avgClearance')} value={`${avgClearance}%`} accent />
            <MetricCard label={t('courtPerformance.metric.avgDuration')} value={avgDuration} unit={t('courtPerformance.days')} />
            <MetricCard label={t('courtPerformance.metric.totalBacklog')} value={totalBacklog} />
            <MetricCard label={t('courtPerformance.metric.courtsShown')} value={filtered.length} />
          </div>
        </section>

        {/* ── Clearance rate + Backlog side by side on wide ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title={t('courtPerformance.chart.clearanceRate')}>
            <ClearanceRateChart courts={filtered} />
          </ChartCard>

          <ChartCard title={t('courtPerformance.chart.backlog')}>
            <BacklogChart courts={filtered} />
          </ChartCard>
        </div>

        {/* ── Duration trend ────────────────────────────────────── */}
        <ChartCard title={t('courtPerformance.chart.durationTrend')}>
          <DurationTrendChart />
        </ChartCard>

        {/* ── Detailed table ────────────────────────────────────── */}
        <ChartCard title={t('courtPerformance.table.court')}>
          <PerformanceTable courts={filtered} />
        </ChartCard>

        {/* ── Source note ───────────────────────────────────────── */}
        <p className="text-xs text-[color:var(--color-text-muted)] text-center pb-4">
          {t('courtPerformance.source')}
        </p>
      </div>
    </>
  )
}
