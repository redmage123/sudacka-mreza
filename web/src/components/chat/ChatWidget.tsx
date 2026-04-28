import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import {
  streamChat,
  submitChatFeedback,
  type ChatCitation,
  type ChatStreamEvent,
} from '@/api/chat'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: ChatCitation[]
  status?: string
  trustworthy?: boolean
  feedback?: 'good' | 'bad'
  correctionSubmitted?: boolean
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function activeLang(raw: string | undefined): SupportedLanguage {
  return (SUPPORTED_LANGUAGES.includes(raw as SupportedLanguage) ? raw : 'hr') as SupportedLanguage
}

function CitationChip({
  c,
  lang,
}: {
  c: ChatCitation
  lang: SupportedLanguage
}) {
  const label = `[${c.index}]`
  if (c.kind === 'decision' && c.slug) {
    return (
      <a
        href={`/${lang}/sudska-praksa/${c.slug}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded bg-[color:var(--color-brand-navy)] text-white px-1.5 py-0.5 text-xs hover:bg-[color:var(--color-brand-navy-light)] transition-colors"
        title={`${c.title}${c.caseNumber ? ' — ' + c.caseNumber : ''}`}
      >
        {label}
      </a>
    )
  }
  if (c.kind === 'legal_source' && c.url) {
    return (
      <a
        href={c.url}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded bg-[color:var(--color-brand-gold)] text-black px-1.5 py-0.5 text-xs hover:opacity-80 transition-opacity"
        title={c.title}
      >
        {label}
      </a>
    )
  }
  return (
    <span
      className="inline-block rounded bg-gray-300 text-gray-800 px-1.5 py-0.5 text-xs"
      title={c.title}
    >
      {label}
    </span>
  )
}

function renderWithCitations(
  text: string,
  citations: ChatCitation[] | undefined,
  lang: SupportedLanguage,
): React.ReactNode {
  if (!citations || citations.length === 0) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>
  }
  const byIdx = new Map(citations.map((c) => [c.index, c]))
  const parts: React.ReactNode[] = []
  const re = /\[(\d+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`t${key++}`}>{text.slice(last, m.index)}</span>)
    const idx = Number(m[1])
    const c = byIdx.get(idx)
    if (c) {
      parts.push(<CitationChip key={`c${key++}`} c={c} lang={lang} />)
    } else {
      parts.push(<span key={`t${key++}`}>{m[0]}</span>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(<span key={`t${key++}`}>{text.slice(last)}</span>)
  return <span className="whitespace-pre-wrap break-words">{parts}</span>
}

export function ChatWidget() {
  const { t, i18n } = useTranslation('chat')
  const { lang: rawLang } = useParams<{ lang: string }>()
  const lang = activeLang(rawLang)

  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId] = useState(() => uid())
  const [langBanner, setLangBanner] = useState<string | null>(null)
  const [correctionFor, setCorrectionFor] = useState<string | null>(null)
  const [correctionText, setCorrectionText] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Banner the user when they switch language mid-conversation. Old turns
  // stay visible, but new replies will come back in the new language.
  useEffect(() => {
    const handler = (lng: string) => {
      if (turns.length > 0) {
        setLangBanner(t('langSwitched', { lang: lng }))
        const id = window.setTimeout(() => setLangBanner(null), 6000)
        return () => window.clearTimeout(id)
      }
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [i18n, t, turns.length])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, turns])

  const send = useCallback(async () => {
    const q = input.trim()
    if (!q || sending) return
    const userTurn: ChatTurn = { id: uid(), role: 'user', content: q }
    const asstId = uid()
    const asstTurn: ChatTurn = { id: asstId, role: 'assistant', content: '' }
    const history = turns.map((tt) => ({ role: tt.role, content: tt.content }))
    setTurns((prev) => [...prev, userTurn, asstTurn])
    setInput('')
    setSending(true)
    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      for await (const ev of streamChat({ question: q, lang, history, signal: ctl.signal })) {
        applyEvent(setTurns, asstId, ev)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTurns((prev) =>
        prev.map((tt) => (tt.id === asstId ? { ...tt, content: tt.content || `${t('error')}: ${msg}` } : tt)),
      )
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }, [input, lang, sending, t, turns])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearConvo = useCallback(() => {
    abortRef.current?.abort()
    setTurns([])
    setLangBanner(null)
    setCorrectionFor(null)
  }, [])

  const onFeedback = useCallback(
    async (turnId: string, verdict: 'good' | 'bad') => {
      const a = turns.find((x) => x.id === turnId)
      if (!a || a.role !== 'assistant') return
      const userQ = previousUser(turns, turnId)
      setTurns((prev) => prev.map((x) => (x.id === turnId ? { ...x, feedback: verdict } : x)))
      if (verdict === 'good') {
        try {
          await submitChatFeedback({
            conversationId,
            question: userQ,
            lang,
            modelAnswer: a.content,
            citations: a.citations ?? [],
            verdict: 'good',
          })
        } catch {
          /* swallow — UI already showed thumb */
        }
      } else {
        setCorrectionFor(turnId)
        setCorrectionText('')
      }
    },
    [conversationId, lang, turns],
  )

  const submitCorrection = useCallback(async () => {
    if (!correctionFor) return
    const a = turns.find((x) => x.id === correctionFor)
    if (!a) return
    const userQ = previousUser(turns, correctionFor)
    try {
      await submitChatFeedback({
        conversationId,
        question: userQ,
        lang,
        modelAnswer: a.content,
        citations: a.citations ?? [],
        verdict: 'bad',
        correction: correctionText.trim() || undefined,
      })
      setTurns((prev) =>
        prev.map((x) => (x.id === correctionFor ? { ...x, correctionSubmitted: true } : x)),
      )
      setCorrectionFor(null)
      setCorrectionText('')
    } catch {
      /* leave the form open so the user can retry */
    }
  }, [conversationId, correctionFor, correctionText, lang, turns])

  const fab = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('closeWidget') : t('openWidget')}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-[color:var(--color-brand-navy)] text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        <span aria-hidden className="text-2xl">{open ? '×' : '⚖'}</span>
      </button>
    ),
    [open, t],
  )

  return (
    <>
      {fab}
      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed bottom-24 right-5 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-7rem))] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-border)]">
            <strong className="text-sm">{t('title')}</strong>
            <button
              type="button"
              onClick={clearConvo}
              className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            >
              {t('clear')}
            </button>
          </div>

          {langBanner && (
            <div className="px-3 py-1 text-xs bg-[color:var(--color-brand-gold)] text-black">
              {langBanner}
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {turns.length === 0 && (
              <div className="text-[color:var(--color-text-muted)] italic">{t('emptyHint')}</div>
            )}
            {turns.map((tt) => (
              <div key={tt.id} className={tt.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={
                    tt.role === 'user'
                      ? 'inline-block bg-[color:var(--color-brand-navy)] text-white rounded px-2 py-1 max-w-[85%]'
                      : 'inline-block bg-[color:var(--color-surface-alt,#f3f4f6)] rounded px-2 py-1 max-w-[95%]'
                  }
                >
                  {renderWithCitations(tt.content || (tt.role === 'assistant' && sending ? t('thinking') : ''), tt.citations, lang)}
                </div>
                {tt.role === 'assistant' && tt.content && !sending && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                    <span>{t('helpful')}</span>
                    <button
                      type="button"
                      onClick={() => onFeedback(tt.id, 'good')}
                      disabled={tt.feedback !== undefined}
                      className={`px-1.5 py-0.5 rounded border ${tt.feedback === 'good' ? 'bg-green-100 border-green-400' : 'border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-alt,#f3f4f6)]'}`}
                      aria-label={t('yes')}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedback(tt.id, 'bad')}
                      disabled={tt.feedback !== undefined}
                      className={`px-1.5 py-0.5 rounded border ${tt.feedback === 'bad' ? 'bg-red-100 border-red-400' : 'border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-alt,#f3f4f6)]'}`}
                      aria-label={t('no')}
                    >
                      👎
                    </button>
                    {tt.correctionSubmitted && <span className="text-green-700">{t('correctionThanks')}</span>}
                  </div>
                )}
                {correctionFor === tt.id && (
                  <div className="mt-1 p-2 bg-[color:var(--color-surface-alt,#f3f4f6)] rounded text-xs">
                    <div className="font-medium mb-1">{t('correctionTitle')}</div>
                    <textarea
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      placeholder={t('correctionPlaceholder')}
                      rows={3}
                      className="w-full p-1 border border-[color:var(--color-border)] rounded text-xs"
                    />
                    <div className="mt-1 flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setCorrectionFor(null)}
                        className="px-2 py-1 border border-[color:var(--color-border)] rounded"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={submitCorrection}
                        className="px-2 py-1 bg-[color:var(--color-brand-navy)] text-white rounded"
                      >
                        {t('correctionSubmit')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
            className="border-t border-[color:var(--color-border)] p-2 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              maxLength={800}
              className="flex-1 px-2 py-1 border border-[color:var(--color-border)] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-gold)]"
              aria-label={t('placeholder')}
            />
            {sending ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
              >
                {t('stop')}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-3 py-1 bg-[color:var(--color-brand-navy)] text-white rounded text-sm disabled:opacity-50"
              >
                {t('send')}
              </button>
            )}
          </form>
        </div>
      )}
    </>
  )
}

function previousUser(turns: ChatTurn[], assistantId: string): string {
  const i = turns.findIndex((x) => x.id === assistantId)
  for (let j = i - 1; j >= 0; j--) {
    if (turns[j].role === 'user') return turns[j].content
  }
  return ''
}

function applyEvent(
  setTurns: React.Dispatch<React.SetStateAction<ChatTurn[]>>,
  assistantId: string,
  ev: ChatStreamEvent,
): void {
  setTurns((prev) =>
    prev.map((tt) => {
      if (tt.id !== assistantId) return tt
      switch (ev.type) {
        case 'token':
          return { ...tt, content: tt.content + ev.text }
        case 'citations':
          return { ...tt, citations: ev.citations }
        case 'done':
          return {
            ...tt,
            content: ev.answer || tt.content,
            status: ev.status,
            trustworthy: ev.trustworthy,
          }
        case 'error':
          return { ...tt, content: tt.content || `Error: ${ev.message}` }
        default:
          return tt
      }
    }),
  )
}
