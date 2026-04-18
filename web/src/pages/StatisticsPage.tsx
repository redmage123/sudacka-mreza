import { useEffect, useState } from 'react'
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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { getStatistics, type Statistics } from '@/api/statistics'

// ─── Design-system palette ────────────────────────────────────────────────────
const NAVY = '#0D2B55'
const GOLD = '#C8941A'
const CHART_PALETTE = [NAVY, GOLD, '#1A3F72', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#0891B2']

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number | string
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
      </p>
      <p className={`text-sm ${accent ? 'text-white/70' : 'text-[color:var(--color-text-muted)]'}`}>
        {label}
      </p>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4 border-b border-[color:var(--color-border)] pb-2">
      {children}
    </h2>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </div>
  )
}

// Friendly tooltip that respects dark-mode surface colours
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg px-3 py-2 text-sm text-[color:var(--color-text)]">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function DecisionsPerCourtPerYearChart({ data }: { data: Statistics['decisionsPerCourtPerYear'] }) {
  const { t } = useTranslation('common')

  // Pivot flat [{court, year, count}] → [{court, "2022": n, "2023": n, ...}]
  const yearSet = Array.from(new Set(data.map((d) => d.year))).sort()
  const courtSet = Array.from(new Set(data.map((d) => d.court)))
  const pivoted = courtSet.map((court) => {
    const row: Record<string, string | number> = { court }
    for (const year of yearSet) {
      const match = data.find((d) => d.court === court && d.year === year)
      row[String(year)] = match?.count ?? 0
    }
    return row
  })
  // Sort courts by total descending
  pivoted.sort((a, b) => {
    const sumA = yearSet.reduce((s, y) => s + ((a[String(y)] as number) ?? 0), 0)
    const sumB = yearSet.reduce((s, y) => s + ((b[String(y)] as number) ?? 0), 0)
    return sumB - sumA
  })
  // Shorten long court names for the axis
  const shortenName = (name: string) =>
    name.length > 22 ? name.slice(0, 20) + '…' : name

  if (!pivoted.length) return <p className="text-sm text-[color:var(--color-text-muted)]">{t('statistics.noData')}</p>

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={pivoted} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" />
        <YAxis
          type="category"
          dataKey="court"
          width={140}
          tickFormatter={shortenName}
          tick={{ fontSize: 11 }}
          stroke="var(--color-text-muted)"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {yearSet.map((year, i) => (
          <Bar key={year} dataKey={String(year)} name={String(year)} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[0, 3, 3, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function DecisionsByTypeChart({ data }: { data: Statistics['decisionsByType'] }) {
  const { t } = useTranslation('common')

  const labelled = data.map((d) => ({
    ...d,
    label: t(`statistics.type.${d.type}`, d.type),
  }))

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
  }) => {
    if (percent < 0.04) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (!labelled.length) return <p className="text-sm text-[color:var(--color-text-muted)]">{t('statistics.noData')}</p>

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={labelled}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
          labelLine={false}
          label={renderLabel}
        >
          {labelled.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [value.toLocaleString(), name]}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
          }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 13 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function MonthlyTrendChart({ data }: { data: Statistics['monthlyTrend'] }) {
  const { t } = useTranslation('common')

  const formatted = data.map((d) => {
    const [year, month] = d.month.split('-')
    return {
      ...d,
      label: `${month}/${year?.slice(2)}`,
    }
  })

  if (!formatted.length) return <p className="text-sm text-[color:var(--color-text-muted)]">{t('statistics.noData')}</p>

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-text-muted)" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="count"
          name={t('statistics.series.decisions')}
          stroke={NAVY}
          strokeWidth={2.5}
          dot={{ r: 3, fill: GOLD, stroke: NAVY, strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: GOLD }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TopCourtsTable({ data }: { data: Statistics['topCourts'] }) {
  const { t } = useTranslation('common')

  if (!data.length) return <p className="text-sm text-[color:var(--color-text-muted)]">{t('statistics.noData')}</p>
  const max = data[0]?.count ?? 1

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={t('statistics.table.ariaLabel')}>
        <thead>
          <tr className="border-b border-[color:var(--color-border)]">
            <th className="py-2 px-2 text-left font-semibold text-[color:var(--color-text-muted)] w-8">#</th>
            <th className="py-2 px-2 text-left font-semibold text-[color:var(--color-text-muted)]">{t('statistics.table.court')}</th>
            <th className="py-2 px-2 text-right font-semibold text-[color:var(--color-text-muted)] w-20">{t('statistics.table.decisions')}</th>
            <th className="py-2 px-2 text-left font-semibold text-[color:var(--color-text-muted)]">{t('statistics.table.share')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const pct = max > 0 ? (row.count / max) * 100 : 0
            return (
              <tr
                key={row.court}
                className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-subtle)] transition-colors"
              >
                <td className="py-2.5 px-2 text-[color:var(--color-text-muted)] font-mono text-xs">{i + 1}</td>
                <td className="py-2.5 px-2 text-[color:var(--color-text)] font-medium">{row.court}</td>
                <td className="py-2.5 px-2 text-right font-semibold text-[color:var(--color-heading)]">
                  {row.count.toLocaleString()}
                </td>
                <td className="py-2.5 px-2 w-36">
                  <div className="h-2 rounded-full bg-[color:var(--color-surface-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: i === 0 ? GOLD : NAVY }}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExpertsBySpecialtyChart({ data }: { data: Statistics['expertsBySpecialty'] }) {
  const { t } = useTranslation('common')
  const top = data.slice(0, 12)

  if (!top.length) return <p className="text-sm text-[color:var(--color-text-muted)]">{t('statistics.noData')}</p>

  const shortenLabel = (s: string) => (s.length > 28 ? s.slice(0, 26) + '…' : s)
  const expertsLabel = t('statistics.series.experts')

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-text-muted)" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="specialty"
          width={172}
          tickFormatter={shortenLabel}
          tick={{ fontSize: 11 }}
          stroke="var(--color-text-muted)"
        />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), expertsLabel]}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
          }}
        />
        <Bar dataKey="count" name={expertsLabel} radius={[0, 4, 4, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill={i % 2 === 0 ? NAVY : GOLD} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatisticsPage() {
  const { t } = useTranslation('common')
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStatistics()
      .then(setStats)
      .catch(() => setError(t('statistics.loadError')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <>
      <Helmet>
        <title>{t('statistics.title')} — Sudačka Mreža</title>
        <meta name="description" content={t('statistics.description')} />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* ── Page header ─────────────────────────────────────── */}
        <div className="border-b border-[color:var(--color-border)] pb-6">
          <h1 className="text-3xl font-bold text-[color:var(--color-heading)] mb-2">{t('statistics.title')}</h1>
          <p className="text-[color:var(--color-text-muted)]">
            {t('statistics.description')}
          </p>
        </div>

        {/* ── Loading / error states ───────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-busy="true" aria-label={t('statistics.loading.ariaLabel')}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-[color:var(--color-error)] bg-[color:var(--color-error-bg)] text-[color:var(--color-error)] px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* ── Total counts ──────────────────────────────────── */}
            <section aria-label={t('statistics.totals.ariaLabel')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label={t('statistics.metric.decisions')} value={stats.totals.decisions} accent />
                <MetricCard label={t('statistics.metric.courts')} value={stats.totals.courts} />
                <MetricCard label={t('statistics.metric.experts')} value={stats.totals.experts} />
                <MetricCard label={t('statistics.metric.interpreters')} value={stats.totals.interpreters} />
              </div>
            </section>

            {/* ── Top two charts side by side on wide screens ──── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title={t('statistics.chart.monthlyTrend')}>
                <MonthlyTrendChart data={stats.monthlyTrend} />
              </ChartCard>

              <ChartCard title={t('statistics.chart.byType')}>
                <DecisionsByTypeChart data={stats.decisionsByType} />
              </ChartCard>
            </div>

            {/* ── Full-width per-court-per-year chart ──────────── */}
            <ChartCard title={t('statistics.chart.perCourtYear')}>
              <DecisionsPerCourtPerYearChart data={stats.decisionsPerCourtPerYear} />
            </ChartCard>

            {/* ── Ranking + specialty side by side ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title={t('statistics.chart.topCourts')}>
                <TopCourtsTable data={stats.topCourts} />
              </ChartCard>

              <ChartCard title={t('statistics.chart.bySpecialty')}>
                <ExpertsBySpecialtyChart data={stats.expertsBySpecialty} />
              </ChartCard>
            </div>

            {/* ── Footer note ───────────────────────────────────── */}
            <p className="text-xs text-[color:var(--color-text-muted)] text-center pb-4">
              {t('statistics.footer')}
            </p>
          </>
        )}
      </div>
    </>
  )
}
