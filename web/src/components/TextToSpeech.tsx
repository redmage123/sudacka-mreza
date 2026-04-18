import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

interface TextToSpeechProps {
  text: string
  className?: string
}

export function TextToSpeech({ text, className = '' }: TextToSpeechProps) {
  const { t } = useTranslation('common')
  const { lang } = useParams<{ lang: string }>()
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const toggle = useCallback(async () => {
    // If playing, stop
    if (playing && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      return
    }

    setLoading(true)
    try {
      const resp = await fetch('/api/nlp/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 2000), language: lang ?? 'hr' }),
      })

      if (!resp.ok) {
        // Fall back to browser Speech API
        fallbackBrowserTTS(text, lang ?? 'hr')
        setLoading(false)
        return
      }

      const data = await resp.json()
      if (data.audio) {
        const audioBlob = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))
        const blob = new Blob([audioBlob], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)

        if (audioRef.current) {
          audioRef.current.pause()
        }

        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url) }
        audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(url) }
        audio.play()
        setPlaying(true)
      }
    } catch {
      // Fall back to browser Speech API
      fallbackBrowserTTS(text, lang ?? 'hr')
    }
    setLoading(false)
  }, [text, lang, playing])

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand-navy)] dark:hover:text-[color:var(--color-brand-gold)] disabled:opacity-50 ${className}`}
      aria-label={playing ? t('tts.stop', 'Stop reading') : t('tts.start', 'Read aloud')}
      title={playing ? t('tts.stop', 'Stop reading') : t('tts.start', 'Read aloud')}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32" />
        </svg>
      ) : playing ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
        </svg>
      )}
      {loading ? t('tts.loading', 'Loading...') : playing ? t('tts.stop', 'Stop') : t('tts.start', 'Listen')}
    </button>
  )
}

function fallbackBrowserTTS(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return
  const langMap: Record<string, string> = {
    hr: 'hr-HR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
    it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL',
  }
  const utterance = new SpeechSynthesisUtterance(text.substring(0, 5000))
  utterance.lang = langMap[lang] ?? 'hr-HR'
  utterance.rate = 0.9
  speechSynthesis.speak(utterance)
}
