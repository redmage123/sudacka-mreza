import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { usePageTitle } from '@/hooks/usePageTitle'

// Mirrors http://www.sudacka-mreza.hr/sadrzaj.aspx?G1=donirajte — short
// instructions for donating to Sudačka Mreža.
export default function DonationsPage() {
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('donate')

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: tn('donate', 'Donirajte') },
        ]}
      />
      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-2 mt-6">
        Donirajte
      </h1>
      <p className="text-[color:var(--color-text-muted)] mb-10">
        Hvala što razmišljate o podršci Sudačkoj Mreži. Vaša donacija pomaže nam održati portal
        slobodnim za sve korisnike — suce, odvjetnike, vještake, tumače i građane.
      </p>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">Bankovni račun</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="font-medium text-[color:var(--color-text-muted)]">Primatelj</dt>
          <dd className="text-[color:var(--color-text)]">Sudačka Mreža</dd>
          <dt className="font-medium text-[color:var(--color-text-muted)]">IBAN</dt>
          <dd className="font-mono text-[color:var(--color-text)]">HR00 0000 0000 0000 0000 0</dd>
          <dt className="font-medium text-[color:var(--color-text-muted)]">Model</dt>
          <dd className="font-mono text-[color:var(--color-text)]">HR00</dd>
          <dt className="font-medium text-[color:var(--color-text-muted)]">Poziv na broj</dt>
          <dd className="font-mono text-[color:var(--color-text)]">slobodan unos</dd>
          <dt className="font-medium text-[color:var(--color-text-muted)]">Svrha</dt>
          <dd className="text-[color:var(--color-text)]">Donacija — Sudačka Mreža</dd>
        </dl>
        <p className="mt-4 text-xs text-[color:var(--color-text-muted)]">
          Za točan IBAN i instrukcije, kontaktirajte nas putem stranice{' '}
          <a href={`/${locale}/kontakt`} className="text-[color:var(--color-brand)] hover:underline">
            Kontakt
          </a>
          .
        </p>
      </section>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-2">Donatori i partneri</h2>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Sudačka Mreža dosadašnji je rad zahvaljuje brojnim donatorima i partnerima — popis se nalazi
          na stranici{' '}
          <a href={`/${locale}/o-nama`} className="text-[color:var(--color-brand)] hover:underline">
            O nama
          </a>
          .
        </p>
      </section>
    </div>
  )
}
