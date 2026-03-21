import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import hrNav from './locales/hr/nav.json'
import hrCommon from './locales/hr/common.json'
import enNav from './locales/en/nav.json'
import enCommon from './locales/en/common.json'

export const SUPPORTED_LANGUAGES = ['hr', 'en'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'hr'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      hr: { nav: hrNav, common: hrCommon },
      en: { nav: enNav, common: enCommon },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'nav'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Detect language from URL path: /hr/... or /en/...
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    },
  })

export default i18n
