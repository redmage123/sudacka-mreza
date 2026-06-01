import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

interface Department {
  id?: string; name?: string; type?: string; head?: string; phone?: string; email?: string; notes?: string;
}
interface JurisdictionRich { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } }
interface TimeAvailability {
  monday?: string; tuesday?: string; wednesday?: string; thursday?: string;
  friday?: string; saturday?: string; sunday?: string; notes?: string;
}
interface Court {
  id: number; name: string; type: string; address?: string; city?: string;
  phone?: string; fax?: string; email?: string; website?: string;
  president?: string; county?: string;
  jurisdiction?: string;
  jurisdictionScope?: JurisdictionRich | string;
  jurisdictionArea?: unknown;
  timeAvailability?: TimeAvailability;
  departments?: Department[];
}



function hasTimeAvailability(ta?: TimeAvailability): boolean {
  if (!ta) return false
  return Boolean(ta.monday || ta.tuesday || ta.wednesday || ta.thursday || ta.friday || ta.saturday || ta.sunday || ta.notes)
}

function extractJurisdiction(court: { jurisdictionScope?: JurisdictionRich | string; jurisdiction?: string }): string | undefined {
  if (typeof court.jurisdictionScope === 'string' && court.jurisdictionScope) return court.jurisdictionScope
  const root = (typeof court.jurisdictionScope === 'object' ? court.jurisdictionScope?.root : undefined)
  if (root && Array.isArray(root.children)) {
    const text = root.children
      .map((block) => (block.children ?? []).map((n) => n.text ?? '').join(''))
      .filter(Boolean)
      .join('\n')
    if (text) return text
  }
  return court.jurisdiction
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
    if (!id) return
    fetch(`/api/courts/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCourt(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8"><div className="animate-pulse h-64 bg-[color:var(--color-surface-subtle)] rounded" /></div>

  if (!court) return <div className="mx-auto max-w-4xl px-4 py-8 text-center"><p className="text-[color:var(--color-text-muted)]">{t('courts.notFound', 'Court not found')}</p></div>

  const fields = [
    { label: t('courts.address', 'Address'), value: [court.address, court.city].filter(Boolean).join(', ') },
    { label: t('courts.phone', 'Phone'), value: court.phone },
    { label: t('courts.fax', 'Fax'), value: court.fax },
    { label: t('courts.email', 'Email'), value: court.email },
    { label: t('courts.website', 'Website'), value: court.website },
    { label: t('courts.president', 'President'), value: court.president },
    { label: t('courts.county', 'County'), value: court.county },
    { label: t('courts.jurisdictionScope', 'Područje nadležnosti'), value: extractJurisdiction(court) },
  ].filter(f => f.value)

  // Court departments (Odjeli suda): registry, president's office, etc.
  const DEPT_TYPE: Record<string, string> = {
    registry: t('courts.dept.registry', 'Pisarnica'),
    president: t('courts.dept.president', 'Ured predsjednika'),
    secretary: t('courts.dept.secretary', 'Tajništvo'),
    spokesperson: t('courts.dept.spokesperson', 'Glasnogovornik'),
    other: t('courts.dept.other', 'Ostalo'),
  }
  const departments = (court.departments ?? []).filter(d => d?.name)

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: tn('courts'), href: `/${locale}/sudovi` }, { label: court.name }]} />
      <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mt-6 mb-2">{court.name}</h1>
      <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-gold)] bg-[color:var(--color-brand-gold)]/10 rounded-full px-3 py-1 mb-6">{court.type}</span>
      <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg divide-y divide-[color:var(--color-border)]">
        {fields.map(f => (
          <div key={f.label} className="flex px-4 py-3">
            <dt className="w-1/3 text-sm font-medium text-[color:var(--color-text-muted)]">{f.label}</dt>
            <dd className="w-2/3 text-sm">{f.value}</dd>
          </div>
        ))}
      </div>

      {departments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-3">
            {t('courts.departments', 'Odjeli suda')}
          </h2>
          <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg divide-y divide-[color:var(--color-border)]">
            {departments.map((d, i) => (
              <div key={d.id ?? i} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{d.name}</span>
                  {d.type && DEPT_TYPE[d.type] && (
                    <span className="text-xs font-medium text-[color:var(--color-brand-gold)] bg-[color:var(--color-brand-gold)]/10 rounded-full px-2 py-0.5">
                      {DEPT_TYPE[d.type]}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-[color:var(--color-text-muted)]">
                  {d.head && <span>{t('courts.dept.head', 'Voditelj')}: {d.head}</span>}
                  {d.phone && <span>{t('courts.phone', 'Telefon')}: {d.phone}</span>}
                  {d.email && <span>{d.email}</span>}
                </div>
                {d.notes && (
                  <p className="mt-1 text-xs italic text-[color:var(--color-text-muted)] leading-snug">
                    {d.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {hasTimeAvailability(court.timeAvailability) && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-3">
            {t('courts.timeAvailability.heading', 'Radno vrijeme')}
          </h2>
          <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg divide-y divide-[color:var(--color-border)]">
            {([
              ['monday',    t('courts.timeAvailability.monday',    'Ponedjeljak')],
              ['tuesday',   t('courts.timeAvailability.tuesday',   'Utorak')],
              ['wednesday', t('courts.timeAvailability.wednesday', 'Srijeda')],
              ['thursday',  t('courts.timeAvailability.thursday',  'Četvrtak')],
              ['friday',    t('courts.timeAvailability.friday',    'Petak')],
              ['saturday',  t('courts.timeAvailability.saturday',  'Subota')],
              ['sunday',    t('courts.timeAvailability.sunday',    'Nedjelja')],
            ] as Array<[keyof TimeAvailability, string]>).map(([key, label]) => {
              const ta = court.timeAvailability
              const value = ta ? ta[key] : undefined
              return (
                <div key={key} className="flex px-4 py-3">
                  <dt className="w-1/3 text-sm font-medium text-[color:var(--color-text-muted)]">{label}</dt>
                  <dd className="w-2/3 text-sm">{value || t('courts.timeAvailability.closed', 'Zatvoreno')}</dd>
                </div>
              )
            })}
            {court.timeAvailability?.notes && (
              <div className="flex px-4 py-3">
                <dt className="w-1/3 text-sm font-medium text-[color:var(--color-text-muted)]">{t('courts.timeAvailability.notes', 'Napomena')}</dt>
                <dd className="w-2/3 text-sm whitespace-pre-line">{court.timeAvailability.notes}</dd>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
