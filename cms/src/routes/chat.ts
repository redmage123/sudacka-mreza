/**
 * RAG-style chat endpoint for the public site widget.
 *
 *   POST /api/chat
 *     body: { question: string, history?: [{ role, content }] }
 *     returns: { answer: string, citations: Array<{id, title, caseNumber, court, date, slug}> }
 *
 * Pipeline (matches the "AI pipeline already on the site" requirement):
 *   1. Hybrid search — retrieves top-K Croatian decisions via the existing
 *      /api/decisions/hybrid-search endpoint (Postgres FTS merged with
 *      pgvector semantic via Reciprocal Rank Fusion).
 *   2. Build a system+user prompt with the retrieved excerpts as grounded
 *      context, so the model cites real decisions rather than hallucinating.
 *   3. Call Gemma 4 at the dev-server Ollama endpoint.
 *   4. Return the text answer alongside the citation list so the widget can
 *      render clickable links.
 *
 * Rate limit: a tiny in-process token bucket per client IP. Enough to
 * prevent accidental DoS from a page left open; not a security control.
 */
import { Router, type Request, type Response } from 'express'
import type { Payload } from 'payload'

import {
  detectCaseNumberInQuery,
  exactCaseLookup,
  isRefusal,
  nliVerify,
  trimLlmOutput,
  verifyAnswerRegex,
  type NliResult,
  type RegexVerification,
} from './_chat_verify.js'

type PgPool = {
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

// Use Ollama's native /api/chat endpoint so we can pass num_ctx — the
// OpenAI-compat /v1/chat/completions ignores it and falls back to the
// model's default (32K) which OOMs on our 20 GB card while the batch
// embedder is also resident.
const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://176.9.99.103:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-4-26b-a4b'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''
// Raised to 8192 for topK=10 final context. KV cache at 20 excerpts × 1000
// chars ≈ 5K tokens, plus system + question + response.
const CHAT_NUM_CTX = Number(process.env.CHAT_NUM_CTX || '8192')
// Final top-K after reranking (per leg). Kept at 10 so context stays
// within num_ctx once interleaved.
const RETRIEVAL_TOP_K = Number(process.env.RETRIEVAL_TOP_K || '10')
// Pre-rerank candidate pool (per leg). Fetching a larger superset lets the
// rerank step surface the specific article even when the base embedding
// ranks it low.
function llmHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (LLM_API_TOKEN) h['Authorization'] = 'Bearer ' + LLM_API_TOKEN
  return h
}

const RETRIEVAL_CANDIDATE_K = Number(process.env.RETRIEVAL_CANDIDATE_K || '50')
const ENABLE_RERANK = process.env.ENABLE_RERANK !== '0'

// ── Verification toggles ──────────────────────────────────────────────────
// Default-on: accuracy > latency for a legal assistant.
const VERIFY_REGEX = process.env.VERIFY_REGEX !== '0'
const VERIFY_NLI = process.env.VERIFY_NLI !== '0'
const EXACT_CASE_LOOKUP = process.env.EXACT_CASE_LOOKUP !== '0'
const REFUSE_ON_EMPTY_RETRIEVAL = process.env.REFUSE_ON_EMPTY_RETRIEVAL !== '0'
// Judge model for NLI. Must be a model that's already loaded on Ollama so
// we don't pay cold-start latency per claim. gemma-4-e4b-base coexists
// fine with the main chat model on a 20 GB GPU.
const NLI_MODEL = process.env.NLI_MODEL || 'gemma-4-e4b-base'
const NLI_MAX_CLAIMS = Number(process.env.NLI_MAX_CLAIMS || '6')

// Shape of a single hybrid-search result we need for context + citations.
interface SearchDoc {
  id: string
  title?: string
  caseNumber?: string
  date?: string
  decisionType?: string
  court?: { id?: string; name?: string }
  excerpt?: string
  slug?: string
  rank?: number
  kind?: 'decision' | 'legal_source'
  url?: string       // legal_sources only
  author?: string    // legal_sources only
  sourceType?: string // 'legislation' | 'commentary' | 'manual'
}

// ── Rate limiter: simple per-IP token bucket ────────────────────────────────
const buckets = new Map<string, { tokens: number; last: number }>()
const RATE_CAPACITY = 8           // max burst
const RATE_REFILL_PER_MIN = 6     // ~1 every 10 s

function takeToken(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip) ?? { tokens: RATE_CAPACITY, last: now }
  const elapsedMin = (now - b.last) / 60_000
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + elapsedMin * RATE_REFILL_PER_MIN)
  b.last = now
  if (b.tokens < 1) {
    buckets.set(ip, b)
    return false
  }
  b.tokens -= 1
  buckets.set(ip, b)
  return true
}

/**
 * Rewrite a user question into a compact Croatian search query to improve
 * semantic retrieval against the all-Croatian legal corpus. Falls back to
 * the original question on any failure so the chat still works if Gemma
 * hiccups.
 */
async function rewriteQueryToCroatian(question: string): Promise<string> {
  // If the question is already (mostly) Croatian, skip the call. Heuristic:
  // presence of any Croatian-specific diacritic or a common HR legal word.
  if (/[čćžšđČĆŽŠĐ]/.test(question) || /\b(zakon|sud|kazna|članak|pravo|odluk)/i.test(question)) {
    return question
  }
  try {
    const prompt =
      `Translate the following legal question into a short Croatian search query ` +
      `(5–20 words). Use Croatian legal terminology (Kazneni zakon, razbojništvo, ` +
      `članak, tražbina, stečaj, etc. when appropriate). Reply with ONLY the ` +
      `Croatian query, no quotes or prose.\n\nQuestion: ${question}\n\nCroatian query:`
    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You translate legal questions into concise Croatian retrieval queries.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0.2, num_ctx: 2048, num_predict: 120 },
    }
    const r = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return question
    const j = (await r.json()) as { message?: { content?: string } }
    const out = (j.message?.content ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').slice(0, 300)
    return out.length >= 6 ? out : question
  } catch {
    return question
  }
}

/**
 * Detect "article N" references in the user's question and return the
 * matched article number as a string (e.g. "230" or "230a"). Croatian
 * forms: "čl. 230.", "članak 230.", "čl. 230. KZ". English: "article 230",
 * "art. 230". Returns null if no match.
 */
function extractArticleFromQuery(q: string): string | null {
  // /u flag so \b recognises Croatian letters as word chars — without it
  // the \b before "č" fails silently and "članka 230" never matches.
  const patterns = [
    /(?:^|[\s.,;])(?:čl\.?|članak|članku|članka|članak|članom)\s*(\d+[a-zA-Z]?)/iu,
    /\b(?:article|art\.?)\s*(\d+[a-zA-Z]?)\b/iu,
  ]
  for (const rx of patterns) {
    const m = q.match(rx)
    if (m) return m[1]
  }
  return null
}

/**
 * Detect a statute hint in the query ("Kazneni zakon", "ZOO", "ZPP", etc.)
 * so the article-keyword boost can scope to the right act.
 */
function extractStatuteHint(q: string): string | null {
  const lc = q.toLowerCase()
  // Match Croatian inflections (nominative + genitive + instrumental) on
  // the root of the statute name.
  const hints: Array<[RegExp, string]> = [
    [/\bkazneni(?:m|h)? zakon(?:a|om|u|e)?\b|\bkaznenog zakona\b|\bkaznenom zakonu\b/i, 'Kazneni zakon'],
    [/\bkz\b|\bk\.z\.\b/i, 'Kazneni zakon'],
    [/\bzakon(?:a|om|u|e)? o obveznim\b/i, 'Zakon o obveznim odnosima'],
    [/\bzoo\b/i, 'Zakon o obveznim odnosima'],
    [/\bzakon(?:a|om|u|e)? o parničnom\b|\bparničnog postupka\b|\bparnični postupak\b/i, 'Zakon o parničnom postupku'],
    [/\bzpp\b/i, 'Zakon o parničnom postupku'],
    [/\bzakon(?:a|om|u|e)? o kaznenom postupku\b/i, 'Zakon o kaznenom postupku'],
    [/\bzkp\b/i, 'Zakon o kaznenom postupku'],
    [/\bstečajn(?:i|og|om|im) zakon(?:a|om|u|e)?\b/i, 'Stečajni zakon'],
    [/\bobiteljsk(?:i|og|om|im) zakon(?:a|om|u|e)?\b/i, 'Obiteljski zakon'],
    [/\bzakon(?:a|om|u|e)? o vlasništvu\b/i, 'Zakon o vlasništvu'],
    [/\bzakon(?:a|om|u|e)? o nasljeđ/i, 'Zakon o nasljeđivanju'],
    [/\bustav(?:a|om|u|e)?\b/i, 'Ustav'],
  ]
  for (const [rx, title] of hints) {
    if (rx.test(lc)) return title
  }
  return null
}

/** Embed a query once via Ollama. Shared by both retrieval legs below. */
async function embedQuery(question: string): Promise<number[]> {
  const base = (process.env.LLM_ENDPOINT || 'http://176.9.99.103:11434/v1/chat/completions')
    .replace(/\/v1\/chat\/completions$/, '')
  const model = process.env.EMBED_MODEL || 'nomic-embed-text'
  const r = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: llmHeaders(),
    body: JSON.stringify({ model, input: question }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`embed API returned HTTP ${r.status}`)
  const j = (await r.json()) as { embeddings?: number[][] }
  const v = j.embeddings?.[0]
  if (!v || v.length === 0) throw new Error('embed API returned no vector')
  return v
}

// ── Retrieval ───────────────────────────────────────────────────────────────
// Two legs, run in parallel, both backed by pgvector:
//   1. Court decisions — identified via the site's hybrid-search endpoint
//      (FTS + pgvector with RRF), then re-hydrated with full summary + body.
//   2. Legal sources   — statutes, commentary, judicial-academy manuals;
//      queried directly with a cosine lookup on legal_sources.
// Results are interleaved so the chat grounds on BOTH case law and doctrine.
/**
 * Ask Gemma 4 to rerank a candidate pool. Given the user's question and
 * up to N candidates (by title+short excerpt), return the top-K indices by
 * relevance. Falls back to the original ordering on any failure.
 */
async function rerankWithLLM(
  question: string,
  candidates: Array<{ title: string; excerpt: string }>,
  topK: number,
): Promise<number[]> {
  if (!ENABLE_RERANK || candidates.length <= topK) {
    return candidates.slice(0, topK).map((_, i) => i)
  }
  // Compact list: index + title + first ~250 chars of excerpt.
  const list = candidates
    .map((c, i) => `${i}. ${c.title}\n   ${(c.excerpt || '').replace(/\s+/g, ' ').slice(0, 250)}`)
    .join('\n')
  const prompt =
    `You are reranking retrieval results for a Croatian legal question. ` +
    `From the NUMBERED CANDIDATES below, pick the ${topK} most relevant to ` +
    `answering this question. Prefer specific statute articles over general ` +
    `commentary when the question asks about a concrete rule or penalty.\n\n` +
    `Question: ${question}\n\nCANDIDATES:\n${list}\n\n` +
    `Return ONLY a JSON array of ${topK} integer indices in order of relevance, ` +
    `most relevant first. Example: [12, 3, 27, 0, 8, ...]`
  try {
    const r = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: llmHeaders(),
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'You are a precise reranker. Output JSON only.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: { temperature: 0.1, num_ctx: 8192, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) return candidates.slice(0, topK).map((_, i) => i)
    const j = (await r.json()) as { message?: { content?: string } }
    const text = j.message?.content ?? ''
    const m = text.match(/\[[^\]]*\]/)
    if (!m) return candidates.slice(0, topK).map((_, i) => i)
    const arr = JSON.parse(m[0]) as unknown[]
    const idx = arr
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v >= 0 && v < candidates.length)
    return idx.length >= topK ? idx.slice(0, topK) : idx.concat(
      candidates.map((_, i) => i).filter((i) => !idx.includes(i)).slice(0, topK - idx.length)
    )
  } catch {
    return candidates.slice(0, topK).map((_, i) => i)
  }
}

/**
 * Article-keyword boost (improvement C): when the query mentions
 * "čl. N" / "article N", pull any legal_sources row matching that article
 * (optionally scoped by a statute title hint). These get returned as
 * "must-include" top-priority hits ahead of semantic candidates.
 */
async function articleKeywordHits(
  question: string,
  pool: PgPool,
): Promise<SearchDoc[]> {
  const art = extractArticleFromQuery(question)
  if (!art) return []
  const statute = extractStatuteHint(question)
  const sql = statute
    ? `SELECT id::text, source_type, title, url, author, year, text, article_number
         FROM legal_sources
        WHERE article_number = $1 AND title ILIKE $2
        ORDER BY embedded_at DESC
        LIMIT 5`
    : `SELECT id::text, source_type, title, url, author, year, text, article_number
         FROM legal_sources
        WHERE article_number = $1
        ORDER BY embedded_at DESC
        LIMIT 5`
  const params: unknown[] = statute ? [art, `%${statute}%`] : [art]
  try {
    const rows = await pool.query(sql, params)
    return rows.rows.map((r) => ({
      id: `ls:${r.id}`,
      kind: 'legal_source' as const,
      title: typeof r.title === 'string' ? r.title : '',
      url: typeof r.url === 'string' ? r.url : '',
      author: typeof r.author === 'string' ? r.author : '',
      sourceType: typeof r.source_type === 'string' ? r.source_type : '',
      date: typeof r.year === 'number' ? `${r.year}-01-01` : undefined,
      excerpt: typeof r.text === 'string' ? r.text : '',
    }))
  } catch {
    return []
  }
}

async function retrieveContext(question: string, pool: PgPool, topK = 5): Promise<SearchDoc[]> {
  const port = process.env.PORT || '4094'

  // The corpus is all Croatian. Rewriting non-Croatian queries into Croatian
  // substantially improves recall of the right statute articles.
  const hrQuery = await rewriteQueryToCroatian(question)
  // Fetch a larger candidate pool (C_K) than we need (topK) so the rerank
  // step can surface the right article even when base cosine ranks it low.
  const candK = RETRIEVAL_CANDIDATE_K
  const decisionsUrl = `http://localhost:${port}/api/decisions/hybrid-search?q=${encodeURIComponent(hrQuery)}&limit=${candK}`

  // Run retrievals + keyword boost in parallel. Legal_sources gets BOTH a
  // cosine leg AND a Postgres FTS leg — FTS reliably catches exact Croatian
  // terms (like "razbojništvo") that cosine sometimes misses.
  const [decisionsResp, legalVec, articleHits, legalFtsRes] = await Promise.allSettled([
    fetch(decisionsUrl, { headers: { Accept: 'application/json' } })
      .then((r) => r.ok ? r.json() : { docs: [] })
      .then((j: unknown) => (j as { docs?: SearchDoc[] }).docs ?? []),
    embedQuery(hrQuery),
    articleKeywordHits(question, pool),
    // FTS strategy: AND the 3 longest specific terms from the rewritten
    // Croatian query — that gives tight precision (Art 230 chunk will
    // score high when query mentions "razbojništvo"+"oružje"). If that
    // returns nothing, retry with OR over more terms. Stopwords are
    // filtered out by length >= 4 since Croatian tends toward 5+ char
    // content words.
    (async () => {
      const terms = hrQuery
        .normalize('NFC')
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())
        .filter((w) => w.length >= 4)
      if (terms.length === 0) return { rows: [] }

      // Rank terms by length (longer → more specific); take top 3.
      // Add `:*` suffix so the tsquery prefix-matches Croatian inflections —
      // "oružje" should match "oružjem" / "oružja" / "oružju" etc.,
      // "razbojništvo" should match "razbojništva" / "razbojništvom".
      const byLen = [...new Set(terms)].sort((a, b) => b.length - a.length)
      const keyTerms = byLen.slice(0, 3).map((t) => `${t}:*`)
      const andStr = keyTerms.join(' & ')

      const andQ = await pool.query(
        `SELECT id::text, source_type, title, url, author, year, text,
                ts_rank(to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(title,'')),
                        to_tsquery('simple', $1)) AS rnk
           FROM legal_sources
          WHERE to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(title,'')) @@ to_tsquery('simple', $1)
          ORDER BY rnk DESC
          LIMIT $2`,
        [andStr, candK],
      )
      if (andQ.rows.length >= 3) return andQ

      // Fallback: OR over all distinct long terms, still prefix-matched.
      const orStr = byLen.slice(0, 20).map((t) => `${t}:*`).join(' | ')
      return pool.query(
        `SELECT id::text, source_type, title, url, author, year, text,
                ts_rank(to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(title,'')),
                        to_tsquery('simple', $1)) AS rnk
           FROM legal_sources
          WHERE to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(title,'')) @@ to_tsquery('simple', $1)
          ORDER BY rnk DESC
          LIMIT $2`,
        [orStr, candK],
      )
    })(),
  ])

  // ── Decisions leg: hydrate bodies ───────────────────────────────────────
  const hits: SearchDoc[] =
    decisionsResp.status === 'fulfilled' && Array.isArray(decisionsResp.value)
      ? decisionsResp.value.map((h) => ({ ...h, kind: 'decision' as const }))
      : []
  let hydratedDecisions: SearchDoc[] = []
  if (hits.length > 0) {
    const ids = hits.map((h) => h.id)
    const rows = await pool.query(
      `SELECT cd.id::text, cd.summary, cd.full_text_plain
         FROM court_decisions cd
        WHERE cd.id::text = ANY($1::text[])`,
      [ids],
    )
    const byId = new Map<string, { summary: string; body: string }>()
    for (const r of rows.rows) {
      const id = String(r.id)
      byId.set(id, {
        summary: typeof r.summary === 'string' ? r.summary : '',
        body: typeof r.full_text_plain === 'string' ? r.full_text_plain.slice(0, 2000) : '',
      })
    }
    hydratedDecisions = hits.map((h) => ({
      ...h,
      excerpt: byId.get(h.id)?.summary || byId.get(h.id)?.body || h.excerpt || '',
    }))
  }

  // ── Legal sources leg: cosine lookup over candidate pool ───────────────
  let legalCandidates: SearchDoc[] = []
  if (legalVec.status === 'fulfilled') {
    const vecLit = '[' + legalVec.value.map((x) => x.toFixed(6)).join(',') + ']'
    const rows = await pool.query(
      `SELECT id::text, source_type, title, url, author, year, text
         FROM legal_sources
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
      [vecLit, candK],
    )
    legalCandidates = rows.rows.map((r) => ({
      id: `ls:${r.id}`,
      kind: 'legal_source' as const,
      title: typeof r.title === 'string' ? r.title : '',
      url: typeof r.url === 'string' ? r.url : '',
      author: typeof r.author === 'string' ? r.author : '',
      sourceType: typeof r.source_type === 'string' ? r.source_type : '',
      date: typeof r.year === 'number' ? `${r.year}-01-01` : undefined,
      excerpt: typeof r.text === 'string' ? r.text : '',
    }))
  }

  // ── FTS leg: pull term-matching chunks ─────────────────────────────────
  const ftsDocs: SearchDoc[] =
    legalFtsRes.status === 'fulfilled'
      ? legalFtsRes.value.rows.map((r) => ({
          id: `ls:${r.id}`,
          kind: 'legal_source' as const,
          title: typeof r.title === 'string' ? r.title : '',
          url: typeof r.url === 'string' ? r.url : '',
          author: typeof r.author === 'string' ? r.author : '',
          sourceType: typeof r.source_type === 'string' ? r.source_type : '',
          date: typeof r.year === 'number' ? `${r.year}-01-01` : undefined,
          excerpt: typeof r.text === 'string' ? r.text : '',
        }))
      : []

  // ── Article-keyword boost (C): prepend must-include article hits so the
  // rerank sees them first and is strongly inclined to keep them.
  const articleBoost: SearchDoc[] =
    articleHits.status === 'fulfilled' ? articleHits.value : []

  // Merge FTS + cosine + article boost, deduped by id, preserving the
  // priority: articleBoost > fts > cosine.
  const seenIds = new Set<string>()
  const legalPool: SearchDoc[] = []
  for (const d of [...articleBoost, ...ftsDocs, ...legalCandidates]) {
    if (!seenIds.has(d.id)) {
      legalPool.push(d)
      seenIds.add(d.id)
    }
  }

  // ── Rerank each leg (B): ask Gemma to pick topK from the candidate pool.
  const decisionTopKIdx = await rerankWithLLM(
    question,
    hydratedDecisions.map((d) => ({
      title: `${d.court?.name ?? ''} — ${d.caseNumber ?? ''}`,
      excerpt: d.excerpt ?? '',
    })),
    topK,
  )
  const legalTopKIdx = await rerankWithLLM(
    question,
    legalPool.map((d) => ({
      title: `${d.title ?? ''}${d.sourceType ? ` [${d.sourceType}]` : ''}`,
      excerpt: d.excerpt ?? '',
    })),
    topK,
  )
  const hydratedDecisionsTop = decisionTopKIdx.map((i) => hydratedDecisions[i]).filter(Boolean)
  const legalHits = legalTopKIdx.map((i) => legalPool[i]).filter(Boolean)

  // Interleave: alternate decision / legal_source so both types appear early
  // in the context block regardless of their raw rank.
  const merged: SearchDoc[] = []
  const maxLen = Math.max(hydratedDecisionsTop.length, legalHits.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < hydratedDecisionsTop.length) merged.push(hydratedDecisionsTop[i])
    if (i < legalHits.length) merged.push(legalHits[i])
  }
  return merged.slice(0, topK * 2)
}

// ── Prompt construction ───────────────────────────────────────────────────
const LANG_NAME: Record<string, string> = {
  hr: 'Croatian', en: 'English', de: 'German', it: 'Italian', es: 'Spanish',
  fr: 'French', sv: 'Swedish', da: 'Danish', nl: 'Dutch', pl: 'Polish',
  pt: 'Portuguese', cs: 'Czech', sk: 'Slovak', sl: 'Slovenian', fi: 'Finnish',
  hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian', mt: 'Maltese', el: 'Greek',
  ga: 'Irish (Gaeilge)', et: 'Estonian', lv: 'Latvian', lt: 'Lithuanian',
  uk: 'Ukrainian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  he: 'Hebrew', ar: 'Arabic',
}

function buildMessages(
  question: string,
  docs: SearchDoc[],
  history: Array<{ role: string; content: string }>,
  preferredLang?: string,
): Array<{ role: string; content: string }> {
  const contextBlock = docs
    .map((d, i) => {
      let header: string
      if (d.kind === 'legal_source') {
        // Legislation / commentary / manual. Show the source type + title.
        const kind = d.sourceType ? d.sourceType.toUpperCase() : 'IZVOR'
        const author = d.author ? ` · ${d.author}` : ''
        const year = d.date ? ` (${d.date.slice(0, 4)})` : ''
        header = `${kind}: ${d.title ?? ''}${author}${year}`
      } else {
        // Court decision — court + case number + date.
        const court = d.court?.name ?? ''
        const caseNo = d.caseNumber ?? ''
        const date = d.date ? d.date.split('T')[0] : ''
        header = `${court} · ${caseNo} · ${date}`
      }
      // With topK=10 per leg (up to 20 total), trim each excerpt to keep
      // combined context ≲ 5K tokens (fits num_ctx=8192).
      const excerpt = (d.excerpt ?? '').replace(/<[^>]+>/g, '').slice(0, 1000).trim()
      return `[${i + 1}] ${header}\n${excerpt}`
    })
    .join('\n\n')

  // Sudačka Mreža UI ships in 30 languages. The site-wide language dropdown
  // passes its current choice via `preferredLang` so the chat reply matches
  // the UI regardless of what language the question was typed in. Gemma 4 is
  // fluent enough in all 30; if an unsupported code slips through we fall
  // back to replying in the question's own language.
  const targetLang = preferredLang && LANG_NAME[preferredLang]
    ? LANG_NAME[preferredLang]
    : null
  const languageRule = targetLang
    ? `1. ALWAYS reply in ${targetLang} (this is the language the user has ` +
      `selected in the site's language dropdown), regardless of which language ` +
      `the question was typed in.\n`
    : `1. Detect the language of the user's question and reply in THAT language.\n`

  const systemPrompt =
    `You are a legal assistant specialised in Croatian and EU law, operating as ` +
    `part of the Sudačka Mreža site. The CONTEXT below contains excerpts from ` +
    `Croatian court decisions and legislation retrieved by our hybrid search.\n\n` +
    `Rules:\n` +
    languageRule +
    `2. Answer based on the excerpts. Cite sources with bracketed numbers [1], ` +
    `   [2] etc. matching the CONTEXT entries.\n` +
    `3. The excerpts are in Croatian. Translate the relevant facts into the ` +
    `   user's target language, but keep Croatian case numbers, court names, ` +
    `   OIB, ECLI, statute names (Kazneni zakon, ZOO, ZPP), and article ` +
    `   references (e.g. "čl. 230. KZ") in their original form.\n` +
    `4. If the excerpts do not contain the answer, say so plainly in the user's ` +
    `   language rather than guessing. Do not invent case numbers, dates, or citations.\n` +
    `5. FORMAT the answer in Markdown for readability:\n` +
    `   - Use **bold** for key legal concepts and statute names.\n` +
    `   - Use backticks for inline article references (e.g. \`čl. 230. KZ\`, \`ZOO čl. 230.\`).\n` +
    `   - Use bullet lists for enumerated elements (penalty bands, required fields, ` +
    `     conditions).\n` +
    `   - Put citation numbers in square brackets \`[1]\`, \`[2]\` — do NOT add parentheses ` +
    `     or extra prose around them.\n` +
    `   - Keep paragraphs short (2–4 sentences). No markdown headings (#, ##) — the ` +
    `     widget already renders a title above your answer.\n\n` +
    `--- CONTEXT (top results from Sudačka Mreža hybrid search) ---\n` +
    (contextBlock || '(no relevant decisions found)') +
    `\n--- END CONTEXT ---`

  const msgs: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]
  // Trim history to last 6 turns to keep context small.
  for (const h of history.slice(-6)) {
    if (h.role === 'user' || h.role === 'assistant') {
      msgs.push({ role: h.role, content: String(h.content).slice(0, 2000) })
    }
  }
  msgs.push({ role: 'user', content: question })
  return msgs
}

// ── Gemma 4 call ──────────────────────────────────────────────────────────
async function streamModel(
  messages: Array<{ role: string; content: string }>,
  payload: Payload,
  onToken: (chunk: string) => void,
): Promise<string> {
  // CHAT_ENDPOINT resolves to Ollama's native /api/chat (see URL rewrite at
  // top of file), which streams NDJSON not SSE. We also disable Gemma 4's
  // thinking mode via `think:false` so content appears immediately.
  const body = {
    model: LLM_MODEL,
    messages,
    stream: true,
    think: false,
    keep_alive: -1,
    options: {
      temperature: 0.3,
      num_ctx: CHAT_NUM_CTX,
      num_predict: 600,
    },
  }
  const ctl = AbortSignal.timeout(180_000)
  const r = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: llmHeaders(),
    body: JSON.stringify(body),
    signal: ctl,
  })
  if (!r.ok || !r.body) {
    const text = r.ok ? '' : await r.text().catch(() => '')
    payload.logger.warn({ status: r.status, body: text.slice(0, 300) }, 'LLM streaming returned non-2xx')
    throw new Error(`LLM call failed: HTTP ${r.status}`)
  }
  const reader = (r.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''
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
        const ev = JSON.parse(line) as {
          message?: { content?: string }
          done?: boolean
        }
        const chunk = ev.message?.content ?? ''
        if (chunk) {
          full += chunk
          onToken(chunk)
        }
        if (ev.done) return full
      } catch {
        /* skip unparseable chunk */
      }
    }
  }
  return full
}

// ── Router ────────────────────────────────────────────────────────────────
export function createChatRouter(payload: Payload): Router {
  const router = Router()

  router.post('/chat', async (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.ip || 'unknown'
    if (!takeToken(ip)) {
      return res.status(429).json({ errors: [{ message: 'Rate limit — try again in a moment.' }] })
    }

    const body = (req.body ?? {}) as {
      question?: string
      history?: Array<{ role: string; content: string }>
      lang?: string
    }
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return res.status(400).json({ errors: [{ message: 'question required' }] })
    }
    if (question.length > 800) {
      return res.status(400).json({ errors: [{ message: 'question too long (max 800 chars)' }] })
    }
    const history = Array.isArray(body.history) ? body.history : []
    const preferredLang = typeof body.lang === 'string' && body.lang.length === 2
      ? body.lang.toLowerCase()
      : undefined

    let docs: SearchDoc[] = []
    const pool = (payload.db as { pool: PgPool }).pool

    // ── Exact case-number shortcut ─────────────────────────────────────────
    // Questions like "Sažmi kratko predmet Pp-4159/2024-5" or "Kojeg datuma je
    // donesena odluka u predmetu Gž-461/2022-2?" are keyed lookups, not
    // semantic ones. Hybrid search loses these among ~9k near-identical court
    // templates — resolve them directly against court_decisions so the right
    // decision lands at position [1] before the hybrid retriever runs.
    const exactCaseNumber = EXACT_CASE_LOOKUP ? detectCaseNumberInQuery(question) : null
    let exactHit: SearchDoc | null = null
    if (exactCaseNumber) {
      const hits = await exactCaseLookup(exactCaseNumber, pool, 1)
      if (hits.length > 0) {
        const h = hits[0]
        exactHit = {
          id: h.id,
          kind: 'decision' as const,
          title: h.title,
          caseNumber: h.caseNumber,
          date: h.date,
          court: h.court,
          slug: h.slug,
          excerpt: h.excerpt,
        }
        payload.logger.info({ caseNumber: exactCaseNumber }, 'chat: exact case-ID shortcut hit')
      }
    }

    try {
      docs = await retrieveContext(question, pool, RETRIEVAL_TOP_K)
    } catch (e) {
      payload.logger.warn({ err: e }, 'hybrid-search failed; proceeding without context')
    }

    // Prepend the exact hit (if any) and dedupe by id so it's at position [1].
    if (exactHit) {
      docs = [exactHit, ...docs.filter((d) => d.id !== exactHit!.id)]
    }

    // ── Empty-retrieval refusal gate ──────────────────────────────────────
    // Without any cited context the model will try to answer from parametric
    // memory. For a legal assistant that's the path to hallucinations.
    if (REFUSE_ON_EMPTY_RETRIEVAL && docs.length === 0) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store')
      res.flushHeaders?.()
      const refusal =
        'Na temelju priloženih izvora ne mogu pouzdano odgovoriti na ovo pitanje. ' +
        'Preporučujem konzultirati izvornu zakonsku odredbu ili nadležni sud.'
      res.write(JSON.stringify({ type: 'token', text: refusal }) + '\n')
      res.write(JSON.stringify({ type: 'citations', citations: [] }) + '\n')
      res.write(JSON.stringify({
        type: 'done',
        answer: refusal,
        status: 'refused_low_retrieval',
        trustworthy: false,
      }) + '\n')
      res.end()
      return
    }

    const messages = buildMessages(question, docs, history, preferredLang)

    // Stream NDJSON {type:'token'|'citations'|'done'|'error', ...} lines.
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const citations = docs.map((d) => ({
      id: d.id,
      kind: d.kind ?? 'decision',
      title: d.title,
      caseNumber: d.caseNumber,
      date: d.date,
      court: d.court?.name,
      slug: d.slug,
      url: d.url,
      author: d.author,
      sourceType: d.sourceType,
    }))

    const t0 = Date.now()
    payload.logger.info({ q: question.slice(0,60) }, 'chat: before streamModel')
    let firstTokAt: number | null = null
    try {
      const full = await streamModel(messages, payload, (chunk) => {
        if (firstTokAt === null) {
          firstTokAt = Date.now() - t0
          payload.logger.info({ firstTokMs: firstTokAt }, 'chat: first token received')
        }
        res.write(JSON.stringify({ type: 'token', text: chunk }) + '\n')
      })
      payload.logger.info({ totalMs: Date.now() - t0, chars: full.length }, 'chat: streamModel done')

      // Strip thinking tags + trim any trailing context-delimiter leakage.
      const stripped = full.replace(/^<think>[\s\S]*?<\/think>\s*/i, '').trim()
      const answer = trimLlmOutput(stripped)

      res.write(JSON.stringify({ type: 'citations', citations }) + '\n')

      // ── Post-stream verification ─────────────────────────────────────────
      // Passage texts the verifiers compare against — what the LLM actually
      // saw, including header + excerpt.
      const passagesForVerify = docs.map((d, i) => ({
        index: i + 1,
        text: [
          d.title ?? '',
          d.court?.name ?? '',
          d.caseNumber ?? '',
          d.author ?? '',
          d.excerpt ?? '',
        ].filter((x) => x).join(' · '),
      }))
      const passageTexts = passagesForVerify.map((p) => p.text)

      let regex: RegexVerification | null = null
      let nli: NliResult | null = null

      if (VERIFY_REGEX && answer.length > 0) {
        try {
          regex = verifyAnswerRegex(answer, passageTexts, question)
        } catch (e) {
          payload.logger.warn({ err: e }, 'regex verify failed')
        }
      }

      const refusedByModel = isRefusal(answer)
      if (VERIFY_NLI && answer.length > 0 && !refusedByModel) {
        try {
          nli = await nliVerify(answer, passagesForVerify, {
            endpoint: CHAT_ENDPOINT,
            model: NLI_MODEL,
            token: LLM_API_TOKEN || undefined,
            maxClaims: NLI_MAX_CLAIMS,
          })
          payload.logger.info({
            faithful: nli.faithful,
            nClaims: nli.nClaims,
            sup: nli.nSupported,
            uns: nli.nUnsupported,
          }, 'chat: NLI verification done')
        } catch (e) {
          payload.logger.warn({ err: e }, 'NLI verify failed')
        }
      }

      // Status resolution
      let status: 'answered' | 'flagged' | 'flagged_nli' | 'refused_by_model'
      if (refusedByModel) {
        status = 'refused_by_model'
      } else if (regex && (!regex.citationsValid || !regex.entitiesGrounded)) {
        status = 'flagged'
      } else if (nli && !nli.faithful) {
        status = 'flagged_nli'
      } else {
        status = 'answered'
      }
      const trustworthy = status === 'answered'

      if (regex || nli) {
        res.write(JSON.stringify({
          type: 'verification',
          regex,
          nli: nli ? {
            faithful: nli.faithful,
            nClaims: nli.nClaims,
            nSupported: nli.nSupported,
            nPartial: nli.nPartial,
            nUnsupported: nli.nUnsupported,
            nNeutral: nli.nNeutral,
            claims: nli.claims,
          } : null,
        }) + '\n')
      }

      res.write(JSON.stringify({ type: 'done', answer, status, trustworthy }) + '\n')
      res.end()
    } catch (e) {
      payload.logger.error({ err: e }, 'chat LLM streaming failed')
      res.write(JSON.stringify({ type: 'error', message: 'The assistant is unavailable right now — please try again.' }) + '\n')
      res.end()
    }
    return
  })

  return router
}
