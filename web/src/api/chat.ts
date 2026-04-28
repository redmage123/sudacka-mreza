import { API_BASE } from './client'

export interface ChatCitation {
  index: number
  kind: 'decision' | 'legal_source'
  title: string
  caseNumber?: string
  court?: string
  date?: string
  slug?: string
  url?: string
  author?: string
  sourceType?: string
}

export type ChatStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'citations'; citations: ChatCitation[] }
  | { type: 'done'; answer: string; status?: string; trustworthy?: boolean }
  | { type: 'verification'; nli?: unknown; regex?: unknown }
  | { type: 'error'; message: string }

export interface ChatRequest {
  question: string
  lang: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  signal?: AbortSignal
}

export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatStreamEvent> {
  const r = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: req.question, lang: req.lang, history: req.history }),
    signal: req.signal,
  })
  if (!r.ok || !r.body) {
    let msg = `HTTP ${r.status}`
    try {
      const j = (await r.json()) as { errors?: Array<{ message?: string }> }
      if (j.errors?.[0]?.message) msg = j.errors[0].message
    } catch {
      /* ignore */
    }
    yield { type: 'error', message: msg }
    return
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      try {
        yield JSON.parse(line) as ChatStreamEvent
      } catch {
        /* skip malformed */
      }
    }
  }
}

export interface ChatFeedbackBody {
  conversationId: string
  question: string
  lang: string
  modelAnswer: string
  citations: ChatCitation[]
  verdict: 'good' | 'bad'
  correction?: string
  reason?: string
}

export async function submitChatFeedback(body: ChatFeedbackBody): Promise<void> {
  const r = await fetch(`${API_BASE}/chat-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    throw new Error(`feedback HTTP ${r.status}`)
  }
}
