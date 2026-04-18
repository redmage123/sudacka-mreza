import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export function InstallPrompt() {
  const { t } = useTranslation('common')
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('pwa-install-dismissed') === '1',
  )

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const handler = () => setPromptEvent(null)
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  if (!promptEvent || dismissed) return null

  const handleInstall = async () => {
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setPromptEvent(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1')
    setDismissed(true)
  }

  return (
    <div
      role="banner"
      aria-label={t('pwa.installApp')}
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg p-4 flex items-start gap-3"
    >
      <img src="/apple-touch-icon.png" alt="" aria-hidden="true" className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[color:var(--color-text)]">{t('pwa.title')}</p>
        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">{t('pwa.description')}</p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => void handleInstall()} className="flex-1 rounded-md bg-[color:var(--color-brand-gold)] text-white text-xs font-medium px-3 py-1.5 hover:opacity-90 transition-opacity">
            {t('pwa.install')}
          </button>
          <button onClick={handleDismiss} className="rounded-md border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] text-xs px-3 py-1.5 hover:bg-[color:var(--color-surface-subtle)] transition-colors">
            {t('pwa.noThanks')}
          </button>
        </div>
      </div>
    </div>
  )
}
