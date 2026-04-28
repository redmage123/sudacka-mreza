import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import hrNav from './locales/hr/nav.json'
import hrCommon from './locales/hr/common.json'
import hrChat from './locales/hr/chat.json'
import enNav from './locales/en/nav.json'
import enCommon from './locales/en/common.json'
import enChat from './locales/en/chat.json'
import deNav from './locales/de/nav.json'
import deCommon from './locales/de/common.json'
import deChat from './locales/de/chat.json'
import frNav from './locales/fr/nav.json'
import frCommon from './locales/fr/common.json'
import frChat from './locales/fr/chat.json'
import bgNav from './locales/bg/nav.json'
import bgCommon from './locales/bg/common.json'
import bgChat from './locales/bg/chat.json'
import csNav from './locales/cs/nav.json'
import csCommon from './locales/cs/common.json'
import csChat from './locales/cs/chat.json'
import daNav from './locales/da/nav.json'
import daCommon from './locales/da/common.json'
import daChat from './locales/da/chat.json'
import elNav from './locales/el/nav.json'
import elCommon from './locales/el/common.json'
import elChat from './locales/el/chat.json'
import esNav from './locales/es/nav.json'
import esCommon from './locales/es/common.json'
import esChat from './locales/es/chat.json'
import etNav from './locales/et/nav.json'
import etCommon from './locales/et/common.json'
import etChat from './locales/et/chat.json'
import euNav from './locales/eu/nav.json'
import euCommon from './locales/eu/common.json'
import euChat from './locales/eu/chat.json'
import fiNav from './locales/fi/nav.json'
import fiCommon from './locales/fi/common.json'
import fiChat from './locales/fi/chat.json'
import gaNav from './locales/ga/nav.json'
import gaCommon from './locales/ga/common.json'
import gaChat from './locales/ga/chat.json'
import huNav from './locales/hu/nav.json'
import huCommon from './locales/hu/common.json'
import huChat from './locales/hu/chat.json'
import isNav from './locales/is/nav.json'
import isCommon from './locales/is/common.json'
import isChat from './locales/is/chat.json'
import itNav from './locales/it/nav.json'
import itCommon from './locales/it/common.json'
import itChat from './locales/it/chat.json'
import jaNav from './locales/ja/nav.json'
import jaCommon from './locales/ja/common.json'
import jaChat from './locales/ja/chat.json'
import ltNav from './locales/lt/nav.json'
import ltCommon from './locales/lt/common.json'
import ltChat from './locales/lt/chat.json'
import lvNav from './locales/lv/nav.json'
import lvCommon from './locales/lv/common.json'
import lvChat from './locales/lv/chat.json'
import mtNav from './locales/mt/nav.json'
import mtCommon from './locales/mt/common.json'
import mtChat from './locales/mt/chat.json'
import nbNav from './locales/nb/nav.json'
import nbCommon from './locales/nb/common.json'
import nbChat from './locales/nb/chat.json'
import nlNav from './locales/nl/nav.json'
import nlCommon from './locales/nl/common.json'
import nlChat from './locales/nl/chat.json'
import plNav from './locales/pl/nav.json'
import plCommon from './locales/pl/common.json'
import plChat from './locales/pl/chat.json'
import ptNav from './locales/pt/nav.json'
import ptCommon from './locales/pt/common.json'
import ptChat from './locales/pt/chat.json'
import roNav from './locales/ro/nav.json'
import roCommon from './locales/ro/common.json'
import roChat from './locales/ro/chat.json'
import skNav from './locales/sk/nav.json'
import skCommon from './locales/sk/common.json'
import skChat from './locales/sk/chat.json'
import slNav from './locales/sl/nav.json'
import slCommon from './locales/sl/common.json'
import slChat from './locales/sl/chat.json'
import svNav from './locales/sv/nav.json'
import svCommon from './locales/sv/common.json'
import svChat from './locales/sv/chat.json'
import ukNav from './locales/uk/nav.json'
import ukCommon from './locales/uk/common.json'
import ukChat from './locales/uk/chat.json'
import arNav from './locales/ar/nav.json'
import arCommon from './locales/ar/common.json'
import arChat from './locales/ar/chat.json'
import zhNav from './locales/zh/nav.json'
import zhCommon from './locales/zh/common.json'
import zhChat from './locales/zh/chat.json'

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
      hr: { nav: hrNav, common: hrCommon, chat: hrChat },
      en: { nav: enNav, common: enCommon, chat: enChat },
      de: { nav: deNav, common: deCommon, chat: deChat },
      fr: { nav: frNav, common: frCommon, chat: frChat },
      bg: { nav: bgNav, common: bgCommon, chat: bgChat },
      cs: { nav: csNav, common: csCommon, chat: csChat },
      da: { nav: daNav, common: daCommon, chat: daChat },
      el: { nav: elNav, common: elCommon, chat: elChat },
      es: { nav: esNav, common: esCommon, chat: esChat },
      et: { nav: etNav, common: etCommon, chat: etChat },
      eu: { nav: euNav, common: euCommon, chat: euChat },
      fi: { nav: fiNav, common: fiCommon, chat: fiChat },
      ga: { nav: gaNav, common: gaCommon, chat: gaChat },
      hu: { nav: huNav, common: huCommon, chat: huChat },
      is: { nav: isNav, common: isCommon, chat: isChat },
      it: { nav: itNav, common: itCommon, chat: itChat },
      ja: { nav: jaNav, common: jaCommon, chat: jaChat },
      lt: { nav: ltNav, common: ltCommon, chat: ltChat },
      lv: { nav: lvNav, common: lvCommon, chat: lvChat },
      mt: { nav: mtNav, common: mtCommon, chat: mtChat },
      nb: { nav: nbNav, common: nbCommon, chat: nbChat },
      nl: { nav: nlNav, common: nlCommon, chat: nlChat },
      pl: { nav: plNav, common: plCommon, chat: plChat },
      pt: { nav: ptNav, common: ptCommon, chat: ptChat },
      ro: { nav: roNav, common: roCommon, chat: roChat },
      sk: { nav: skNav, common: skCommon, chat: skChat },
      sl: { nav: slNav, common: slCommon, chat: slChat },
      sv: { nav: svNav, common: svCommon, chat: svChat },
      uk: { nav: ukNav, common: ukCommon, chat: ukChat },
      ar: { nav: arNav, common: arCommon, chat: arChat },
      zh: { nav: zhNav, common: zhCommon, chat: zhChat },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: ['common', 'nav', 'chat'],
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
