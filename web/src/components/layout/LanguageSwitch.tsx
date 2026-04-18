import { useNavigate, useParams, useLocation } from 'react-router'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'

// Endonyms: each language name in its own script/language.
// These are NEVER translated — a language selector always shows native names.
const ENDONYMS: Record<string, string> = {
  ar: 'العربية',
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  et: 'Eesti',
  eu: 'Euskara',
  fi: 'Suomi',
  fr: 'Français',
  ga: 'Gaeilge',
  hr: 'Hrvatski',
  hu: 'Magyar',
  is: 'Íslenska',
  it: 'Italiano',
  ja: '日本語',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  mt: 'Malti',
  nb: 'Norsk bokmål',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sv: 'Svenska',
  uk: 'Українська',
  zh: '中文',
}

export function LanguageSwitch() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams<{ lang: string }>()
  // Always derive active language from the URL /:lang param so the dropdown
  // and page language can never disagree — even on direct navigation or refresh.
  const rawLang = params.lang ?? 'hr'
  const currentLang = (SUPPORTED_LANGUAGES.includes(rawLang as SupportedLanguage)
    ? rawLang
    : 'hr') as SupportedLanguage

  function switchLang(lang: SupportedLanguage) {
    if (lang === currentLang) return
    const langPattern = new RegExp(`^/(${SUPPORTED_LANGUAGES.join('|')})`)
    // NOTE: Do NOT call i18n.changeLanguage() here. AppShell's useEffect syncs
    // i18n with the URL lang param, so only navigate() is needed.
    const pathWithoutLang = location.pathname.replace(langPattern, '')
    navigate(`/${lang}${pathWithoutLang}${location.search}${location.hash}`, { replace: true })
  }

  return (
    <select
      value={currentLang}
      onChange={(e) => switchLang(e.target.value as SupportedLanguage)}
      aria-label="Select language"
      className="bg-transparent text-sm font-medium text-[color:var(--color-text-inverse)] border border-[color:var(--color-brand-navy-light)] rounded px-1 py-0.5 cursor-pointer hover:border-[color:var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-gold)]"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang} lang={lang} className="bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)]">
          {ENDONYMS[lang] ?? lang.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
