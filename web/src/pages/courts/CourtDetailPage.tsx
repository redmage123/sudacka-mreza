import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

interface Court {
  id: number; name: string; type: string; address?: string; city?: string;
  phone?: string; fax?: string; email?: string; website?: string;
  president?: string; county?: string; jurisdiction?: string;
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
    { label: t('courts.jurisdiction', 'Jurisdiction'), value: court.jurisdiction },
  ].filter(f => f.value)

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
    </div>
  )
}
