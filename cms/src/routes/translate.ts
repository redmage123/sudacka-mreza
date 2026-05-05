// Croatian-source translation endpoint backed by the local Ollama model.
//
// POST /api/nlp/translate
//   body: { text: string, source?: 'hr', target: string }
//   returns: { translated: string }
//
// Aliased under /api/translate for callers that don't include the /nlp prefix.
//
// The frontend used to call /api/nlp/translate against a Python NLP service
// that no longer exists; this route stands in for it using the same Ollama
// instance that backs decision briefs. A small in-memory LRU caches results
// so repeat reads of the same body don't re-pay the LLM cost.

import { Router } from 'express'
import type { Payload } from 'payload'
import crypto from 'node:crypto'

const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://176.9.99.103:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-4-e4b-eurlex-v1'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''

const MAX_INPUT_CHARS = 6000
const CACHE_LIMIT = 500
const cache = new Map<string, string>()

function cacheKey(source: string, target: string, text: string): string {
  return `${source}${target}${crypto.createHash('sha1').update(text).digest('hex')}`
}
function cacheGet(k: string): string | undefined {
  const v = cache.get(k)
  if (v !== undefined) {
    cache.delete(k)
    cache.set(k, v)
  }
  return v
}
function cacheSet(k: string, v: string) {
  cache.set(k, v)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic', bg: 'Bulgarian', cs: 'Czech', da: 'Danish', de: 'German',
  el: 'Greek', en: 'English', es: 'Spanish', et: 'Estonian', eu: 'Basque',
  fi: 'Finnish', fr: 'French', ga: 'Irish', hr: 'Croatian', hu: 'Hungarian',
  is: 'Icelandic', it: 'Italian', ja: 'Japanese', lt: 'Lithuanian',
  lv: 'Latvian', mt: 'Maltese', nb: 'Norwegian Bokmål', nl: 'Dutch',
  pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', sk: 'Slovak',
  sl: 'Slovenian', sv: 'Swedish', uk: 'Ukrainian',
  zh: 'Chinese (Simplified, Han characters)',
}

function llmHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LLM_API_TOKEN) h['Authorization'] = 'Bearer ' + LLM_API_TOKEN
  return h
}

export function createTranslateRouter(payload: Payload): Router {
  const router = Router()

  const handler = async (req: import('express').Request, res: import('express').Response) => {
    const body = (req.body || {}) as { text?: string; source?: string; target?: string }
    const text = (body.text || '').trim()
    const source = (body.source || 'hr').toLowerCase()
    const target = (body.target || '').toLowerCase()
    if (!text) return res.status(400).json({ error: 'text required' })
    if (!target || !LANG_NAMES[target]) return res.status(400).json({ error: 'invalid target' })
    if (target === source) return res.json({ translated: text })

    const truncated = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text
    const k = cacheKey(source, target, truncated)
    const hit = cacheGet(k)
    if (hit) return res.json({ translated: hit, fromCache: true })

    const sourceName = LANG_NAMES[source] || source
    const targetName = LANG_NAMES[target] || target
    const prompt =
      `Translate the following ${sourceName} legal text into ${targetName}. ` +
      `Preserve all citations, statute names, article numbers, case numbers, OIB numbers, ECLI/CELEX codes, dates, and proper names verbatim. ` +
      `Output only the translation. Do not add commentary, prefaces, or labels.\n\n` +
      `--- ${sourceName.toUpperCase()} TEXT ---\n` +
      truncated

    try {
      const r = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: llmHeaders(),
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: `You are a professional legal translator. Output only the requested ${targetName} translation, with no preface or commentary.` },
            { role: 'user', content: prompt },
          ],
          stream: false,
          think: false,
          options: {
            temperature: 0.2,
            top_p: 0.9,
            num_ctx: 8192,
            num_predict: 2200,
            repeat_penalty: 1.15,
            repeat_last_n: 256,
          },
        }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!r.ok) {
        payload.logger?.error?.(`translate: HTTP ${r.status}`)
        return res.status(502).json({ error: 'LLM call failed' })
      }
      const j = (await r.json()) as { message?: { content?: string } }
      let translated = (j.message?.content || '').trim().replace(/^[`"']+|[`"']+$/g, '').trim()
      if (!translated) return res.status(502).json({ error: 'empty LLM response' })
      // Strip a leading "Translation:" / "Here is the translation:" preface if
      // the model emitted one despite the system instruction.
      translated = translated.replace(/^(translation|here is the translation|here's the translation)[:\s—-]+/i, '').trim()
      cacheSet(k, translated)
      return res.json({ translated, fromCache: false })
    } catch (e) {
      payload.logger?.error?.(`translate: ${e instanceof Error ? e.message : String(e)}`)
      return res.status(502).json({ error: 'translation failed' })
    }
  }

  router.post('/nlp/translate', handler)
  router.post('/translate', handler)
  return router
}
