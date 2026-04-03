import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ko from './ko.json'
import en from './en.json'
import ja from './ja.json'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'
import es from './es.json'
import ptBR from './pt-BR.json'
import fr from './fr.json'
import de from './de.json'
import id from './id.json'

function detectLanguage(): string {
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  if (lang === 'zh-tw' || lang === 'zh-hant' || lang.startsWith('zh-hant')) return 'zh-TW'
  if (lang.startsWith('zh')) return 'zh-CN'
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('pt')) return 'pt-BR'
  if (lang.startsWith('fr')) return 'fr'
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('id')) return 'id'
  return 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      es: { translation: es },
      'pt-BR': { translation: ptBR },
      fr: { translation: fr },
      de: { translation: de },
      id: { translation: id },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
