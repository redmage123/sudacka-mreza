import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'

interface SubscribeFormProps {
  court?: string
  category?: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

const SUBSCRIPTION_TYPE_OPTIONS = [
  { value: 'decisions', label: 'Odluke' },
  { value: 'news', label: 'Vijesti' },
  { value: 'experts', label: 'Vještaci i tumači' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'Sve kategorije' },
  { value: 'civil', label: 'Građansko' },
  { value: 'criminal', label: 'Kazneno' },
  { value: 'commercial', label: 'Trgovačko' },
  { value: 'administrative', label: 'Upravno' },
  { value: 'constitutional', label: 'Ustavno' },
]

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Dnevno' },
  { value: 'weekly', label: 'Tjedno' },
]

export function SubscribeForm({ court, category }: SubscribeFormProps) {
  const [email, setEmail] = useState('')
  const [subscriptionType, setSubscriptionType] = useState('decisions')
  const [courtValue, setCourtValue] = useState(court ?? '')
  const [categoryValue, setCategoryValue] = useState(category ?? '')
  const [keyword, setKeyword] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const isDecisions = subscriptionType === 'decisions'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    const body: Record<string, unknown> = {
      email,
      subscription_type: subscriptionType,
      frequency,
    }

    if (isDecisions) {
      body.filters = {
        ...(courtValue ? { court: courtValue } : {}),
        ...(categoryValue ? { category: categoryValue } : {}),
        ...(keyword ? { keyword } : {}),
      }
    }

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (response.status === 409) {
        setStatus('error')
        setErrorMessage('Već ste pretplaćeni s ovom adresom.')
        return
      }

      if (!response.ok) {
        let msg = 'Došlo je do greške. Pokušajte ponovo.'
        try {
          const data = (await response.json()) as { error?: string }
          if (data.error) msg = data.error
        } catch {
          // ignore
        }
        setStatus('error')
        setErrorMessage(msg)
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('Greška u komunikaciji s poslužiteljem. Pokušajte ponovo.')
    }
  }

  if (status === 'success') {
    return (
      <div
        className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
        role="status"
        aria-live="polite"
      >
        <p className="text-[color:var(--color-text)]">
          Uspješno ste se pretplatili! Potvrda je poslana na vašu e-mail adresu.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h2 className="text-lg font-semibold text-[color:var(--color-heading)] mb-4">
        Pretplatite se na obavijesti
      </h2>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="E-mail adresa"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading'}
          autoComplete="email"
        />

        <Select
          label="Vrsta pretplate"
          required
          value={subscriptionType}
          onChange={(e) => setSubscriptionType(e.target.value)}
          disabled={status === 'loading'}
          options={SUBSCRIPTION_TYPE_OPTIONS}
        />

        {isDecisions && (
          <>
            <Input
              label="Sud"
              type="text"
              value={courtValue}
              onChange={(e) => setCourtValue(e.target.value)}
              disabled={status === 'loading'}
              placeholder="npr. Vrhovni sud"
            />

            <Select
              label="Vrsta odluke"
              value={categoryValue}
              onChange={(e) => setCategoryValue(e.target.value)}
              disabled={status === 'loading'}
              options={CATEGORY_OPTIONS}
            />

            <Input
              label="Ključna riječ"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={status === 'loading'}
              placeholder="npr. ovrha"
            />
          </>
        )}

        <Select
          label="Učestalost"
          required
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={status === 'loading'}
          options={FREQUENCY_OPTIONS}
        />

        {status === 'error' && errorMessage && (
          <p role="alert" className="text-sm text-[color:var(--color-error)]">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={status === 'loading'}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Slanje...' : 'Pretplati se'}
        </Button>
      </form>
    </div>
  )
}

export default SubscribeForm
