/**
 * On-demand translator for short Croatian legal text snippets (titles +
 * excerpts) into the user's selected UI language. Backed by Gemma 4 via the
 * same Ollama endpoint the chat router uses, with a Postgres-backed cache so
 * the same snippet is only translated once per language.
 *
 * Cache table (auto-created on first use):
 *   legal_translations(
 *     entity_type, entity_id, field, lang, source_text_hash,
 *     translated, created_at, updated_at,
 *     PRIMARY KEY (entity_type, entity_id, field, lang)
 *   )
 *
 * The translator deliberately keeps Croatian case numbers, ECLI codes,
 * statute names, and article references verbatim — same rule as the chat
 * system prompt. Anything inside parentheses that looks like a citation
 * (e.g. "(Pp-4159/2024-5)") is left untouched.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'

const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://172.18.0.1:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || process.env.LLM_MODEL || 'gemma-4-e4b-base'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''

const LANG_NAMES: Record<string, string> = {
  hr: 'Croatian',
  en: 'English',
  de: 'German',
  fr: 'French',
  bg: 'Bulgarian',
  cs: 'Czech',
  da: 'Danish',
  el: 'Greek',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fi: 'Finnish',
  ga: 'Irish',
  hu: 'Hungarian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mt: 'Maltese',
  nb: 'Norwegian Bokmål',
  nl: 'Dutch',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sv: 'Swedish',
  uk: 'Ukrainian',
  ar: 'Arabic',
  zh: 'Simplified Chinese',
}

function isSupported(lang: string): boolean {
  return lang in LANG_NAMES
}

interface PgPool {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>
}

function poolFromPayload(payload: Payload): PgPool {
  return (payload.db as unknown as { pool: PgPool }).pool
}

let schemaReady = false
async function ensureSchema(pool: PgPool): Promise<void> {
  if (schemaReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS legal_translations (
      entity_type      TEXT NOT NULL,
      entity_id        TEXT NOT NULL,
      field            TEXT NOT NULL,
      lang             TEXT NOT NULL,
      source_text_hash TEXT NOT NULL,
      translated       TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (entity_type, entity_id, field, lang)
    )
  `)
  schemaReady = true
}

function hashText(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 32)
}

function llmHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LLM_API_TOKEN) h['Authorization'] = 'Bearer ' + LLM_API_TOKEN
  return h
}

async function callTranslate(text: string, targetName: string): Promise<string> {
  const prompt =
    `Translate the following Croatian legal text into ${targetName}. ` +
    `Keep these unchanged: case numbers (e.g. Pp-4159/2024-5), ECLI codes, ` +
    `statute names (Kazneni zakon, ZOO, ZPP, Ustav), article references ` +
    `(e.g. "čl. 230. KZ"), court names, OIB numbers, and dates. Reply with ` +
    `ONLY the translated text, no quotes, no prose.\n\nText: ${text}\n\nTranslation:`
  const body = {
    model: TRANSLATE_MODEL,
    messages: [
      { role: 'system', content: 'You translate short Croatian legal snippets accurately, preserving legal references.' },
      { role: 'user', content: prompt },
    ],
    stream: false,
    think: false,
    options: { temperature: 0.2, num_ctx: 2048, num_predict: 400 },
  }
  const r = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: llmHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  if (!r.ok) throw new Error(`translate HTTP ${r.status}`)
  const j = (await r.json()) as { message?: { content?: string } }
  let out = (j.message?.content ?? '').trim()
  // strip stop markers / quotes the model sometimes adds
  out = out.replace(/^[`"']+|[`"']+$/g, '').trim()
  return out
}

interface TranslateField {
  entityType: 'decision' | 'legal_source'
  entityId: string
  field: 'title' | 'excerpt'
  text: string
}

/**
 * Translate a batch of fields into `lang`, using the cache. Returns a Map
 * keyed by `${entityType}:${entityId}:${field}` -> translated string. Falls
 * back to the original text on any per-field failure so callers can render
 * partial translations rather than 500ing the whole search.
 */
export async function translateBatch(
  payload: Payload,
  lang: string,
  fields: TranslateField[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (fields.length === 0) return out
  if (!isSupported(lang) || lang === 'hr') {
    // No translation needed (HR is the source language).
    for (const f of fields) out.set(`${f.entityType}:${f.entityId}:${f.field}`, f.text)
    return out
  }

  const pool = poolFromPayload(payload)
  await ensureSchema(pool)

  // Check cache for all fields at once.
  const params: unknown[] = [lang]
  const placeholders = fields
    .map((f, i) => {
      const base = i * 4 + 2
      params.push(f.entityType, f.entityId, f.field, hashText(f.text))
      return `($${base},$${base + 1},$${base + 2},$${base + 3})`
    })
    .join(',')
  const sql =
    `SELECT entity_type, entity_id, field, source_text_hash, translated ` +
    `FROM legal_translations ` +
    `WHERE lang = $1 AND (entity_type, entity_id, field, source_text_hash) IN (` +
    placeholders +
    `)`
  let cached: Array<{
    entity_type: string
    entity_id: string
    field: string
    source_text_hash: string
    translated: string
  }> = []
  try {
    const r = await pool.query(sql, params)
    cached = r.rows as typeof cached
  } catch {
    // schema race or weird input — fall through to per-field LLM calls
  }
  const cachedKeys = new Set(
    cached.map((r) => `${r.entity_type}:${r.entity_id}:${r.field}:${r.source_text_hash}`),
  )
  for (const r of cached) {
    out.set(`${r.entity_type}:${r.entity_id}:${r.field}`, r.translated)
  }

  // Translate the misses sequentially. With 10 results × 2 fields the worst
  // case is ~20 LLM calls; keep them in-process so we don't blow KV cache.
  const targetName = LANG_NAMES[lang]
  for (const f of fields) {
    const k = `${f.entityType}:${f.entityId}:${f.field}`
    if (out.has(k)) continue
    const hash = hashText(f.text)
    const cacheKey = `${f.entityType}:${f.entityId}:${f.field}:${hash}`
    if (cachedKeys.has(cacheKey)) continue
    if (!f.text || f.text.trim().length === 0) {
      out.set(k, f.text)
      continue
    }
    try {
      const translated = await callTranslate(f.text, targetName)
      out.set(k, translated)
      // Upsert into cache; ignore cache write errors so a misbehaving DB
      // can't break user-facing search.
      try {
        await pool.query(
          `INSERT INTO legal_translations
             (entity_type, entity_id, field, lang, source_text_hash, translated)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (entity_type, entity_id, field, lang)
           DO UPDATE SET translated = EXCLUDED.translated,
                         source_text_hash = EXCLUDED.source_text_hash,
                         updated_at = NOW()`,
          [f.entityType, f.entityId, f.field, lang, hash, translated],
        )
      } catch {
        /* swallow cache write errors */
      }
    } catch (e) {
      payload.logger.warn(
        { err: String(e), lang, field: f.field, id: f.entityId },
        'legal translation failed; falling back to source text',
      )
      out.set(k, f.text)
    }
  }
  return out
}
