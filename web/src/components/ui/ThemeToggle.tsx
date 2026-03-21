import { useTranslation } from 'react-i18next'
import { useDarkMode } from '../../hooks/useDarkMode'

export function ThemeToggle() {
  const { isDark, toggle } = useDarkMode()
  const { t } = useTranslation('nav')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t('lightMode') : t('darkMode')}
      title={isDark ? t('lightMode') : t('darkMode')}
      className="
        flex items-center justify-center
        w-9 h-9 rounded-md
        text-white/80 hover:text-white
        hover:bg-white/10
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-gold)] focus-visible:outline-offset-2
        transition-colors duration-150
      "
    >
      {isDark ? (
        /* Sun icon */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        /* Moon icon */
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
