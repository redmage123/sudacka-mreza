import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from 'react-router'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'

export function LanguageSwitch() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ lang: string }>()
  const currentLang = (params.lang ?? 'hr') as SupportedLanguage

  function switchLang(lang: SupportedLanguage) {
    if (lang === currentLang) return
    // Replace the language segment in the current path
    const pathWithoutLang = location.pathname.replace(/^\/(hr|en)/, '')
    void i18n.changeLanguage(lang)
    navigate(`/${lang}${pathWithoutLang}${location.search}${location.hash}`, { replace: true })
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {SUPPORTED_LANGUAGES.map((lang, idx) => (
        <span key={lang} className="flex items-center">
          {idx > 0 && (
            <span className="mx-1 text-[color:var(--color-brand-navy-light)] select-none" aria-hidden="true">|</span>
          )}
          <button
            type="button"
            onClick={() => switchLang(lang)}
            aria-current={currentLang === lang ? 'true' : undefined}
            lang={lang}
            className={[
              'text-sm font-medium px-1 py-0.5 rounded uppercase tracking-wide transition-colors',
              currentLang === lang
                ? 'text-[color:var(--color-brand-gold)] font-bold'
                : 'text-[color:var(--color-text-inverse)] hover:text-[color:var(--color-brand-gold-light)]',
            ].join(' ')}
          >
            {lang}
          </button>
        </span>
      ))}
    </div>
  )
}
