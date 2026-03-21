import { useTranslation } from 'react-i18next'
import { useDarkMode } from '@/hooks/useDarkMode'

export function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode()
  const { t } = useTranslation('nav')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t('lightMode') : t('darkMode')}
      className="rounded p-2 text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-gold)] transition-colors"
    >
      {isDark ? (
        /* Sun icon */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      ) : (
        /* Moon icon */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
