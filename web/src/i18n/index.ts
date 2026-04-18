import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import hrNav from './locales/hr/nav.json'
import hrCommon from './locales/hr/common.json'
import enNav from './locales/en/nav.json'
import enCommon from './locales/en/common.json'
import deNav from './locales/de/nav.json'
import deCommon from './locales/de/common.json'
import frNav from './locales/fr/nav.json'
import frCommon from './locales/fr/common.json'
import bgNav from './locales/bg/nav.json'
import bgCommon from './locales/bg/common.json'
import csNav from './locales/cs/nav.json'
import csCommon from './locales/cs/common.json'
import daNav from './locales/da/nav.json'
import daCommon from './locales/da/common.json'
import elNav from './locales/el/nav.json'
import elCommon from './locales/el/common.json'
import esNav from './locales/es/nav.json'
import esCommon from './locales/es/common.json'
import etNav from './locales/et/nav.json'
import etCommon from './locales/et/common.json'
import euNav from './locales/eu/nav.json'
import euCommon from './locales/eu/common.json'
import fiNav from './locales/fi/nav.json'
import fiCommon from './locales/fi/common.json'
import gaNav from './locales/ga/nav.json'
import gaCommon from './locales/ga/common.json'
import huNav from './locales/hu/nav.json'
import huCommon from './locales/hu/common.json'
import isNav from './locales/is/nav.json'
import isCommon from './locales/is/common.json'
import itNav from './locales/it/nav.json'
import itCommon from './locales/it/common.json'
import jaNav from './locales/ja/nav.json'
import jaCommon from './locales/ja/common.json'
import ltNav from './locales/lt/nav.json'
import ltCommon from './locales/lt/common.json'
import lvNav from './locales/lv/nav.json'
import lvCommon from './locales/lv/common.json'
import mtNav from './locales/mt/nav.json'
import mtCommon from './locales/mt/common.json'
import nbNav from './locales/nb/nav.json'
import nbCommon from './locales/nb/common.json'
import nlNav from './locales/nl/nav.json'
import nlCommon from './locales/nl/common.json'
import plNav from './locales/pl/nav.json'
import plCommon from './locales/pl/common.json'
import ptNav from './locales/pt/nav.json'
import ptCommon from './locales/pt/common.json'
import roNav from './locales/ro/nav.json'
import roCommon from './locales/ro/common.json'
import skNav from './locales/sk/nav.json'
import skCommon from './locales/sk/common.json'
import slNav from './locales/sl/nav.json'
import slCommon from './locales/sl/common.json'
import svNav from './locales/sv/nav.json'
import svCommon from './locales/sv/common.json'
import ukNav from './locales/uk/nav.json'
import ukCommon from './locales/uk/common.json'
import arNav from './locales/ar/nav.json'
import arCommon from './locales/ar/common.json'
import zhNav from './locales/zh/nav.json'
import zhCommon from './locales/zh/common.json'

export const SUPPORTED_LANGUAGES = [
  'hr', 'en', 'de', 'fr',
  'bg', 'cs', 'da', 'el', 'es', 'et', 'eu', 'fi', 'ga',
  'hu', 'is', 'it', 'ja', 'lt', 'lv', 'mt', 'nb', 'nl',
  'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'uk', 'ar', 'zh',
] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: SupportedLanguage = 'hr'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      hr: { nav: hrNav, common: hrCommon },
      en: { nav: enNav, common: enCommon },
      de: { nav: deNav, common: deCommon },
      fr: { nav: frNav, common: frCommon },
      bg: { nav: bgNav, common: bgCommon },
      cs: { nav: csNav, common: csCommon },
      da: { nav: daNav, common: daCommon },
      el: { nav: elNav, common: elCommon },
      es: { nav: esNav, common: esCommon },
      et: { nav: etNav, common: etCommon },
      eu: { nav: euNav, common: euCommon },
      fi: { nav: fiNav, common: fiCommon },
      ga: { nav: gaNav, common: gaCommon },
      hu: { nav: huNav, common: huCommon },
      is: { nav: isNav, common: isCommon },
      it: { nav: itNav, common: itCommon },
      ja: { nav: jaNav, common: jaCommon },
      lt: { nav: ltNav, common: ltCommon },
      lv: { nav: lvNav, common: lvCommon },
      mt: { nav: mtNav, common: mtCommon },
      nb: { nav: nbNav, common: nbCommon },
      nl: { nav: nlNav, common: nlCommon },
      pl: { nav: plNav, common: plCommon },
      pt: { nav: ptNav, common: ptCommon },
      ro: { nav: roNav, common: roCommon },
      sk: { nav: skNav, common: skCommon },
      sl: { nav: slNav, common: slCommon },
      sv: { nav: svNav, common: svCommon },
      uk: { nav: ukNav, common: ukCommon },
      ar: { nav: arNav, common: arCommon },
      zh: { nav: zhNav, common: zhCommon },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'nav'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Detect language from URL path: /hr/... or /en/... etc.
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 1,
      lookupLocalStorage: 'lang', // AC-6: persisted under key 'lang'
      caches: ['localStorage'],
    },
  })

// Languages written right-to-left. Keep the list explicit so new locales
// default to ltr unless intentionally added here.
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur'])

function applyLangAndDir(lng: string): void {
  const base = lng.split('-')[0]
  document.documentElement.lang = base
  document.documentElement.dir = RTL_LANGS.has(base) ? 'rtl' : 'ltr'
}

// AC-6: keep <html lang> + dir in sync with i18next language changes
i18n.on('languageChanged', (lng) => {
  applyLangAndDir(lng)
})
// Set immediately — bundled resources make init synchronous
if (i18n.isInitialized) {
  applyLangAndDir(i18n.language)
}

export default i18n
