import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_KEY = 'sm_cookie_consent'

interface ConsentState {
  essential: true
  analytics: boolean
  decided: boolean
}

function loadConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ConsentState
  } catch {
    return null
  }
}

function saveConsent(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable (private-browsing edge case) — ignore
  }
}

export function CookieConsent() {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    const existing = loadConsent()
    if (!existing?.decided) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function acceptAll() {
    saveConsent({ essential: true, analytics: true, decided: true })
    setVisible(false)
  }

  function rejectNonEssential() {
    saveConsent({ essential: true, analytics: false, decided: true })
    setVisible(false)
  }

  function saveCustom() {
    saveConsent({ essential: true, analytics, decided: true })
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('cookies.ariaLabel')}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-2xl p-6">
        {!showCustomize ? (
          <>
            <div className="flex items-start gap-3 mb-5">
              <span className="text-2xl select-none" aria-hidden="true">🍪</span>
              <div>
                <h2 className="text-base font-semibold text-[color:var(--color-heading)] mb-1">
                  {t('cookies.title')}
                </h2>
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  {t('cookies.description')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-lg bg-[color:var(--color-brand)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('cookies.acceptAll')}
              </button>
              <button
                onClick={rejectNonEssential}
                className="px-4 py-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm font-medium text-[color:var(--color-text)] hover:border-[color:var(--color-brand)] transition-colors"
              >
                {t('cookies.rejectNonEssential')}
              </button>
              <button
                onClick={() => setShowCustomize(true)}
                className="px-4 py-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm font-medium text-[color:var(--color-text)] hover:border-[color:var(--color-brand)] transition-colors"
              >
                {t('cookies.customize')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-[color:var(--color-heading)] mb-4">
              {t('cookies.customizeTitle')}
            </h2>

            <div className="space-y-3 mb-6">
              {/* Essential — always on */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-[color:var(--color-surface-alt)]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--color-heading)]">
                    {t('cookies.essential')}
                  </p>
                  <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                    {t('cookies.essentialDesc')}
                  </p>
                </div>
                <span className="text-xs text-[color:var(--color-text-muted)] whitespace-nowrap pt-0.5 shrink-0">
                  {t('cookies.alwaysOn')}
                </span>
              </div>

              {/* Analytics — opt-in toggle */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-[color:var(--color-surface-alt)]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--color-heading)]">
                    {t('cookies.analytics')}
                  </p>
                  <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                    {t('cookies.analyticsDesc')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={analytics}
                    onChange={e => setAnalytics(e.target.checked)}
                    aria-label={t('cookies.analytics')}
                  />
                  <div
                    className={`w-10 h-6 rounded-full transition-colors ${analytics ? 'bg-[color:var(--color-brand)]' : 'bg-[color:var(--color-border)]'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${analytics ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={saveCustom}
                className="px-4 py-2 rounded-lg bg-[color:var(--color-brand)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('cookies.savePreferences')}
              </button>
              <button
                onClick={() => setShowCustomize(false)}
                className="px-4 py-2 rounded-lg border border-[color:var(--color-border)] text-sm font-medium text-[color:var(--color-text)] hover:border-[color:var(--color-brand)] transition-colors"
              >
                {t('back')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
