import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from 'react-router'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n/index'

interface LanguageSwitcherProps {
  /** Compact mode for mobile nav */
  compact?: boolean
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { lang } = useParams<{ lang: SupportedLanguage }>()
  const location = useLocation()

  const currentLang = (lang as SupportedLanguage) ?? (i18n.language as SupportedLanguage) ?? 'hr'

  function switchTo(next: SupportedLanguage) {
    if (next === currentLang) return
    // Swap the language segment in the current path
    // e.g. /hr/sudska-praksa → /en/sudska-praksa
    const pathWithoutLang = location.pathname.replace(/^\/(hr|en)/, '')
    navigate(`/${next}${pathWithoutLang}${location.search}${location.hash}`, { replace: true })
    i18n.changeLanguage(next)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Odabir jezika / Language">
        {SUPPORTED_LANGUAGES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            aria-current={l === currentLang ? 'true' : undefined}
            className={`
              px-3 py-1.5 text-sm font-medium rounded uppercase tracking-wide
              transition-colors duration-150
              ${l === currentLang
                ? 'bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }
            `}
          >
            {l}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center" role="group" aria-label="Odabir jezika / Language">
      {SUPPORTED_LANGUAGES.map((l, idx) => (
        <span key={l} className="flex items-center">
          {idx > 0 && (
            <span className="text-white/30 mx-0.5 select-none" aria-hidden="true">|</span>
          )}
          <button
            type="button"
            onClick={() => switchTo(l)}
            aria-current={l === currentLang ? 'true' : undefined}
            className={`
              px-1.5 py-1 text-sm font-medium uppercase tracking-wide rounded
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-gold)] focus-visible:outline-offset-2
              transition-colors duration-150
              ${l === currentLang
                ? 'text-[var(--color-brand-gold)] font-semibold'
                : 'text-white/70 hover:text-white'
              }
            `}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}
