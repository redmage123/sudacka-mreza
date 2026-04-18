'use client'

import { useState } from 'react'

interface VerificationBadgeProps {
  verified: boolean
  verifiedAt?: string | null
  lastConfirmed?: string | null
  expertId: string
  /** 'expert-witnesses' | 'interpreters' */
  collectionSlug: 'expert-witnesses' | 'interpreters'
  /** Whether the current visitor is logged in */
  isLoggedIn: boolean
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function VerificationBadge({
  verified,
  verifiedAt,
  lastConfirmed,
  expertId,
  collectionSlug,
  isLoggedIn,
}: VerificationBadgeProps) {
  const [flagging, setFlagging] = useState(false)
  const [flagSent, setFlagSent] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const apiBase = collectionSlug === 'expert-witnesses' ? '/api/experts' : '/api/interpreters'

  const tooltipText = lastConfirmed
    ? `Posljednja potvrda: ${formatDate(lastConfirmed)}`
    : verified && verifiedAt
    ? `Verificirano: ${formatDate(verifiedAt)}`
    : undefined

  const handleFlag = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${apiBase}/${expertId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Greška pri slanju prijave.')
        return
      }
      setFlagSent(true)
      setFlagging(false)
    } catch {
      setError('Greška pri slanju prijave.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="verification-badge">
      {/* Verification status */}
      {verified ? (
        <div
          className="verified-status"
          title={tooltipText}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <circle cx="10" cy="10" r="10" fill="#16a34a" />
            <path
              d="M6 10.5l3 3 5-5"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ color: '#16a34a', fontWeight: 500, fontSize: '0.9em' }}>
            Verificirano
          </span>
          {verifiedAt && (
            <span style={{ color: '#6b7280', fontSize: '0.8em' }}>
              ({formatDate(verifiedAt)})
            </span>
          )}
        </div>
      ) : (
        <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>Nije verificirano</span>
      )}

      {/* Report inaccuracy — logged-in users only */}
      {isLoggedIn && !flagSent && (
        <div style={{ marginTop: 8 }}>
          {!flagging ? (
            <button
              type="button"
              onClick={() => setFlagging(true)}
              style={{
                fontSize: '0.8em',
                color: '#b91c1c',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Prijavi netočne podatke
            </button>
          ) : (
            <div style={{ marginTop: 4 }}>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Opišite netočnost…"
                rows={3}
                style={{
                  width: '100%',
                  fontSize: '0.85em',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  resize: 'vertical',
                }}
              />
              {error && (
                <p style={{ color: '#b91c1c', fontSize: '0.8em', margin: '4px 0 0' }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={handleFlag}
                  disabled={!reason.trim() || submitting}
                  style={{
                    fontSize: '0.8em',
                    background: '#b91c1c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 12px',
                    cursor: reason.trim() && !submitting ? 'pointer' : 'not-allowed',
                    opacity: reason.trim() && !submitting ? 1 : 0.6,
                  }}
                >
                  {submitting ? 'Šaljem…' : 'Pošalji prijavu'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlagging(false)
                    setReason('')
                    setError(null)
                  }}
                  style={{
                    fontSize: '0.8em',
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    padding: '4px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Odustani
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {flagSent && (
        <p style={{ fontSize: '0.8em', color: '#16a34a', marginTop: 6 }}>
          Hvala! Vaša prijava je zaprimljena.
        </p>
      )}
    </div>
  )
}
