import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

interface WeekdayHours {
  weekday?: string
  closed?: boolean
  openTime?: string
  closeTime?: string
  secondOpenTime?: string
  secondCloseTime?: string
  note?: string
}
interface Department {
  id?: string
  name?: string
  type?: string
  head?: string
  phone?: string
  email?: string
  notes?: string
  workingHours?: WeekdayHours[]
}
interface Court {
  id: number; name: string; type: string; address?: string; city?: string;
  phone?: string; fax?: string; email?: string; website?: string;
  president?: string; county?: string; jurisdiction?: string;
  operatingHours?: WeekdayHours[];
  publicServiceHours?: WeekdayHours[];
  departments?: Department[];
}

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_KEY: Record<string, string> = {
  mon: 'admin.weekday.mon',
  tue: 'admin.weekday.tue',
  wed: 'admin.weekday.wed',
  thu: 'admin.weekday.thu',
  fri: 'admin.weekday.fri',
  sat: 'admin.weekday.sat',
  sun: 'admin.weekday.sun',
}

function formatHoursRange(h: WeekdayHours): string {
  if (h.closed) return '—'
  const first = h.openTime && h.closeTime ? `${h.openTime}–${h.closeTime}` : ''
  const second = h.secondOpenTime && h.secondCloseTime ? `, ${h.secondOpenTime}–${h.secondCloseTime}` : ''
  return first ? `${first}${second}` : ''
}

function HoursTable({ hours, t }: { hours: WeekdayHours[]; t: ReturnType<typeof useTranslation>['t'] }) {
  const byDay = new Map<string, WeekdayHours>()
  for (const h of hours) if (h.weekday) byDay.set(h.weekday, h)
  const rows = WEEKDAY_ORDER.map((d) => byDay.get(d)).filter(Boolean) as WeekdayHours[]
  if (rows.length === 0) return null
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((h) => (
          <tr key={h.weekday} className="border-t border-[color:var(--color-border)] first:border-t-0">
            <th className="py-2 pr-3 text-left font-medium text-[color:var(--color-text)] w-1/3">
              {t(WEEKDAY_KEY[h.weekday ?? ''] ?? h.weekday ?? '', h.weekday ?? '')}
            </th>
            <td className="py-2 text-[color:var(--color-text)]">
              {h.closed ? <em className="text-[color:var(--color-text-muted)]">{t('courts.closed', 'Zatvoreno')}</em> : formatHoursRange(h)}
              {h.note && <span className="ml-2 text-xs text-[color:var(--color-text-muted)]">({h.note})</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const DEP_TYPE_KEY: Record<string, string> = {
  registry: 'courts.departments.registry',
  president: 'courts.departments.president',
  secretary: 'courts.departments.secretary',
  spokesperson: 'courts.departments.spokesperson',
  other: 'courts.departments.other',
}
const DEP_TYPE_FALLBACK: Record<string, string> = {
  registry: 'Pisarnica',
  president: 'Ured predsjednika',
  secretary: 'Tajnik',
  spokesperson: 'Glasnogovornik',
  other: 'Ostalo',
}

export default function CourtDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('courtDetail')
  const [court, setCourt] = useState<Court | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) { setLoading(false); return }
    fetch(`/api/courts/${id}?depth=2&locale=${locale}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCourt(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, locale])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8"><div className="animate-pulse h-64 bg-[color:var(--color-surface-subtle)] rounded" /></div>

  if (!court) return <div className="mx-auto max-w-4xl px-4 py-8 text-center"><p className="text-[color:var(--color-text-muted)]">{t('courts.notFound', 'Court not found')}</p></div>

  const fields = [
    { label: t('courts.address', 'Adresa'), value: court.address },
    { label: t('courts.city', 'Grad'), value: court.city },
    { label: t('courts.county', 'Županija'), value: court.county },
    { label: t('courts.phone', 'Telefon'), value: court.phone },
    { label: t('courts.fax', 'Fax'), value: court.fax },
    { label: t('courts.email', 'Email'), value: court.email
      ? <a href={`mailto:${court.email}`} className="text-[color:var(--color-text-link)] hover:underline">{court.email}</a> : null },
    { label: t('courts.website', 'Web stranica'), value: court.website
      ? <a href={court.website} target="_blank" rel="noreferrer" className="text-[color:var(--color-text-link)] hover:underline">{court.website}</a> : null },
    { label: t('courts.president', 'Predsjednik suda'), value: court.president },
    { label: t('courts.jurisdiction', 'Nadležnost'), value: court.jurisdiction },
  ].filter(f => f.value)

  const ops = court.operatingHours ?? []
  const pubs = court.publicServiceHours ?? []
  const deps = court.departments ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: tn('courts'), href: `/${locale}/sudovi` }, { label: court.name }]} />
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-2">{court.name}</h1>
      <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-gold)] bg-[color:var(--color-brand-gold)]/10 rounded-full px-3 py-1 mb-6">{court.type}</span>

      <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg divide-y divide-[color:var(--color-border)] mb-6">
        {fields.map(f => (
          <div key={f.label} className="flex px-4 py-3">
            <dt className="w-1/3 text-sm font-medium text-[color:var(--color-text-muted)]">{f.label}</dt>
            <dd className="w-2/3 text-sm">{f.value}</dd>
          </div>
        ))}
      </div>

      {ops.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-3">
            {t('courts.operatingHours', 'Radno vrijeme suda')}
          </h2>
          <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
            <HoursTable hours={ops} t={t} />
          </div>
        </section>
      )}

      {pubs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-3">
            {t('courts.publicServiceHours', 'Radno vrijeme za stranke')}
          </h2>
          <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
            <HoursTable hours={pubs} t={t} />
          </div>
        </section>
      )}

      {deps.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-3">
            {t('courts.departments.heading', 'Odjeli suda')}
          </h2>
          <div className="space-y-3">
            {deps.map((d, i) => {
              const typeLabel = d.type ? t(DEP_TYPE_KEY[d.type] ?? d.type, DEP_TYPE_FALLBACK[d.type] ?? d.type) : ''
              return (
                <div key={d.id ?? i} className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-[color:var(--color-heading)]">{d.name}</h3>
                    {typeLabel && <span className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)]">{typeLabel}</span>}
                  </div>
                  {(d.head || d.phone || d.email) && (
                    <dl className="mt-2 text-sm space-y-1">
                      {d.head && <div><dt className="inline text-[color:var(--color-text-muted)]">{t('courts.departments.head', 'Voditelj')}: </dt><dd className="inline">{d.head}</dd></div>}
                      {d.phone && <div><dt className="inline text-[color:var(--color-text-muted)]">{t('courts.phone', 'Telefon')}: </dt><dd className="inline">{d.phone}</dd></div>}
                      {d.email && <div><dt className="inline text-[color:var(--color-text-muted)]">{t('courts.email', 'Email')}: </dt><dd className="inline"><a href={`mailto:${d.email}`} className="text-[color:var(--color-text-link)] hover:underline">{d.email}</a></dd></div>}
                    </dl>
                  )}
                  {d.workingHours && d.workingHours.length > 0 && (
                    <div className="mt-3 border-t border-[color:var(--color-border)] pt-3">
                      <div className="text-xs font-semibold text-[color:var(--color-text-muted)] mb-2">{t('courts.departments.workingHours', 'Radno vrijeme odjela')}</div>
                      <HoursTable hours={d.workingHours} t={t} />
                    </div>
                  )}
                  {d.notes && <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{d.notes}</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
