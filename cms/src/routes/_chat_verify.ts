/**
 * Verification layer for /api/chat.
 *
 * Four extra guardrails sit between the streamed LLM answer and the user:
 *
 *   1. exact-case-ID lookup   — resolve "predmet Pp-4159/2024-5" directly
 *                                against court_decisions so hybrid search
 *                                doesn't lose to semantic neighbours among
 *                                9k+ near-identical judicial templates.
 *   2. confidence gate         — refuse if retrieval returned nothing AND
 *                                the question asks about a concrete fact.
 *   3. regex entity grounding  — every case number, article, ECLI, NN ref
 *                                and date in the answer must appear verbatim
 *                                in at least one cited passage.
 *   4. NLI semantic check      — for each claim sentence, ask a small local
 *                                judge (gemma-4-e4b-base) whether it is
 *                                entailed by the cited passage. Catches
 *                                paraphrase errors the regex can't.
 *
 * All four are off-by-default-safe: if a step errors, the original streamed
 * answer still goes through. Verification results surface as an extra
 * `{type:"verification"}` NDJSON frame and a final `status` in `{type:"done"}`.
 */

// ── Entity extraction (Croatian legal domain) ──────────────────────────────
// Case numbers: "Pp-6773/2024-7", "Ovrv-102985/2024-5", "Gž R-130/2024-2",
// "P-215/2022-35", "Kov-784/2024-2".  Two-word prefix (Gž R, Pp G) supported.
export const CASE_NUMBER_RE =
  /\b[A-ZŠĐČĆŽ][a-zčćđšž]*(?:\s+[A-ZŠĐČĆŽ])?-?\s*\d+\/\d{2,4}(?:-\d+)?\b/g
// Article refs: "članak 507", "čl. 507", "članka 507. stavak 2", "art. 230"
export const ARTICLE_RE =
  /(?:\bčlan(?:ak|ka|ku|kom)|\bčl\.?)\s*\d+(?:\.\s*stav(?:ak|ka)?\s*\d+)?/gi
export const ECLI_RE = /ECLI:[A-Z0-9:\-]+/g
export const NN_REF_RE = /\bNN\s+\d+\/\d{2,4}\b/g
export const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\.?/g
export const CITATION_MARKER_RE = /\[(\d+)\]/g

/** All actionable entities that must be grounded in a cited passage. */
export function extractHardEntities(text: string): string[] {
  const set = new Set<string>()
  for (const rx of [CASE_NUMBER_RE, ARTICLE_RE, ECLI_RE, NN_REF_RE, DATE_RE]) {
    rx.lastIndex = 0
    for (const m of text.matchAll(rx)) {
      set.add(m[0].trim())
    }
  }
  return [...set]
}

// ── LLM output cleanup ─────────────────────────────────────────────────────
const STOP_MARKERS = [
  '--- END CONTEXT ---',
  '--- CONTEXT ---',
  '\n---\n',
  '\nPitanje:',
  '\nQuestion:',
  '<|endoftext|>',
]

/** Cut the model's reply at the first stop marker — defends against context
 *  leakage and hallucinated follow-up questions. */
export function trimLlmOutput(text: string): string {
  let out = text
  for (const marker of STOP_MARKERS) {
    const i = out.indexOf(marker)
    if (i >= 0) out = out.slice(0, i)
  }
  return out.trim()
}

// ── Refusal detection ──────────────────────────────────────────────────────
const REFUSAL_PATTERNS = [
  'ne mogu odgovoriti',
  'nije moguće odgovoriti',
  'priloženi izvori ne',
  'dostupni izvodi',
  'nije pokrivena',
  'nije povezano',
  'nema odgovora',
  'u priloženim izvorima nema',
  'u izvorima nema',
  'i do not have',
  'not in the provided',
]

export function isRefusal(answer: string): boolean {
  const lc = answer.toLowerCase()
  return REFUSAL_PATTERNS.some((p) => lc.includes(p))
}

// ── Case-number detection in the user query ────────────────────────────────
/** First case-number-looking token in the query, or null. */
export function detectCaseNumberInQuery(question: string): string | null {
  const m = question.match(CASE_NUMBER_RE)
  return m ? m[0].trim() : null
}

// ── Regex verifier ─────────────────────────────────────────────────────────
export interface RegexVerification {
  citationsValid: boolean
  citedIndices: number[]
  invalidCitations: number[]
  entitiesGrounded: boolean
  ungroundedEntities: string[]
  groundedEntities: string[]
}

/**
 * Verify that every `[N]` in the answer is a real passage index and that
 * every hard entity (case number, article, ECLI, NN ref, date) appears in
 * at least one retrieved passage.  Cited passages are preferred; if an
 * entity appears in any retrieved passage we accept it (the citation may
 * just be missing).
 *
 * The optional `question` argument is used to skip entities that the user
 * already wrote in their own question — if the user asked about case
 * "Gž-461/2022-2", the model is allowed to echo that case number even when
 * retrieval didn't find it.  That echo is not a hallucination.
 */
export function verifyAnswerRegex(
  answer: string,
  passageTexts: string[],
  question?: string,
): RegexVerification {
  const n = passageTexts.length
  // Collect [N] markers
  const rx = new RegExp(CITATION_MARKER_RE.source, 'g')
  const cited: number[] = []
  for (const m of answer.matchAll(rx)) cited.push(Number(m[1]))
  const invalid = cited.filter((c) => c < 1 || c > n)
  const citationsValid = invalid.length === 0
  const citedSet = new Set(cited.filter((c) => c >= 1 && c <= n))

  const citedTexts = [...citedSet].map((i) => passageTexts[i - 1]?.toLowerCase() || '')
  const allTexts = passageTexts.map((t) => t.toLowerCase())
  const questionLc = (question || '').toLowerCase()

  const hard = extractHardEntities(answer)
  const ungrounded: string[] = []
  const grounded: string[] = []
  for (const ent of hard) {
    const needle = ent.toLowerCase()
    if (questionLc.includes(needle)) {
      // Entity is quoted from the user's question — not a hallucination.
      grounded.push(ent)
    } else if (citedTexts.some((t) => t.includes(needle))) {
      grounded.push(ent)
    } else if (allTexts.some((t) => t.includes(needle))) {
      // Present in retrieved context, just not in a cited passage — partial.
      grounded.push(ent)
    } else {
      ungrounded.push(ent)
    }
  }

  return {
    citationsValid,
    citedIndices: [...citedSet].sort((a, b) => a - b),
    invalidCitations: invalid,
    entitiesGrounded: ungrounded.length === 0,
    ungroundedEntities: ungrounded,
    groundedEntities: grounded,
  }
}

// ── NLI semantic verifier ──────────────────────────────────────────────────
export type NliVerdict = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'NEUTRAL' | 'PARSE_ERROR'

export interface NliClaim {
  sentence: string
  verdict: NliVerdict
  citedIndices: number[]
}

export interface NliResult {
  faithful: boolean   // no UNSUPPORTED verdicts
  nClaims: number
  nSupported: number
  nPartial: number
  nUnsupported: number
  nNeutral: number
  claims: NliClaim[]
}

const NLI_SYSTEM =
  'Ti si provjeritelj pravnih tvrdnji. Za svaku tvrdnju ti dajem relevantne ' +
  'izvode iz pravnih izvora. Odgovaraš SAMO jednom od četiri riječi: ' +
  'SUPPORTED, PARTIAL, UNSUPPORTED, NEUTRAL.\n' +
  'SUPPORTED   — tvrdnja je u potpunosti potvrđena izvorima\n' +
  'PARTIAL     — djelomično potvrđena (dio tvrdnje nije u izvorima)\n' +
  'UNSUPPORTED — tvrdnja proturječi izvorima ili nije u njima\n' +
  'NEUTRAL     — tvrdnja je generička / uvod bez činjenica\n' +
  'Ne objašnjavaj. Samo jedna riječ.'

const NONCLAIM_RE =
  /(ne mogu odgovoriti|nije moguće odgovoriti|priloženi izvori|dostupni izvodi|nisam siguran|preporučujem|sažetak izvoda)/i

/** Croatian-aware sentence splitter. Protects common abbreviations. */
export function splitSentences(text: string): string[] {
  const protectRx = /\b(čl|st|tč|br|god|str|al|npr|tzv)\.\s+/g
  const t = text.replace(protectRx, (m) => m.replace('. ', '.# '))
  const parts = t.split(/(?<=[.!?])\s+(?=[A-ZŠĐČĆŽ0-9\[])/)
  return parts.map((p) => p.replace(/\.# /g, '. ').trim()).filter((p) => p.length > 0)
}

function isClaim(sentence: string): boolean {
  if (sentence.length < 15) return false
  if (NONCLAIM_RE.test(sentence)) return false
  return true
}

function parseVerdict(raw: string): NliVerdict {
  const t = raw.trim().toUpperCase()
  for (const v of ['SUPPORTED', 'PARTIAL', 'UNSUPPORTED', 'NEUTRAL'] as const) {
    if (t.includes(v)) return v
  }
  return 'PARSE_ERROR'
}

interface NliOptions {
  endpoint: string          // Ollama /api/chat URL
  model: string             // judge model (e.g. gemma-4-e4b-base)
  token?: string
  maxClaims?: number
  timeoutMs?: number
}

/** Run NLI over each claim sentence of the answer. One Ollama call per
 *  claim (~1-2 s each). Safe to fail: on any error a claim's verdict is
 *  PARSE_ERROR which does NOT count as UNSUPPORTED. */
export async function nliVerify(
  answer: string,
  passages: Array<{ index: number; text: string }>,
  opts: NliOptions,
): Promise<NliResult> {
  const maxClaims = opts.maxClaims ?? 6
  const timeoutMs = opts.timeoutMs ?? 60_000
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token

  const sentences = splitSentences(answer)
  const claims = sentences.filter(isClaim).slice(0, maxClaims)

  const results: NliClaim[] = []
  for (const s of claims) {
    const citedIdx = [...s.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
    const cited =
      citedIdx.length > 0
        ? passages.filter((p) => citedIdx.includes(p.index))
        : passages
    const ctx = cited.map((p) => `[${p.index}] ${p.text}`).join('\n\n')
    const user = `Izvori:\n${ctx}\n\nTvrdnja: ${s}\n\nPresuda (jedna riječ):`
    const body = {
      model: opts.model,
      messages: [
        { role: 'system', content: NLI_SYSTEM },
        { role: 'user', content: user },
      ],
      stream: false,
      think: false,
      options: { temperature: 0.0, num_predict: 20 },
    }
    let verdict: NliVerdict = 'PARSE_ERROR'
    try {
      const r = await fetch(opts.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (r.ok) {
        const j = (await r.json()) as { message?: { content?: string } }
        verdict = parseVerdict(j.message?.content ?? '')
      }
    } catch {
      /* stays PARSE_ERROR */
    }
    results.push({ sentence: s, verdict, citedIndices: citedIdx })
  }

  const count = (v: NliVerdict) => results.filter((r) => r.verdict === v).length
  return {
    faithful: count('UNSUPPORTED') === 0,
    nClaims: results.length,
    nSupported: count('SUPPORTED'),
    nPartial: count('PARTIAL'),
    nUnsupported: count('UNSUPPORTED'),
    nNeutral: count('NEUTRAL'),
    claims: results,
  }
}

// ── Exact case-number DB lookup ────────────────────────────────────────────
type PgPool = {
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export interface ExactCaseHit {
  id: string
  title?: string
  caseNumber?: string
  date?: string
  excerpt: string
  court?: { id?: string; name?: string }
  slug?: string
}

/** Look up a court_decisions row by exact case_number.  Returns at most
 *  `limit` hits (normally 1). Used to short-circuit retrieval for questions
 *  like "Sažmi kratko predmet Pp-4159/2024-5." */
export async function exactCaseLookup(
  caseNumber: string,
  pool: PgPool,
  limit = 1,
): Promise<ExactCaseHit[]> {
  try {
    // Schema: court_decisions.court_id → courts.id (both integer)
    const rows = await pool.query(
      `SELECT cd.id::text, cd.case_number, cd.date::text, cd.summary,
              cd.full_text_plain, cd.slug,
              c.id::text  AS court_id, c.name AS court_name
         FROM court_decisions cd
         LEFT JOIN courts c ON cd.court_id = c.id
        WHERE cd.case_number = $1
        ORDER BY cd.date DESC NULLS LAST
        LIMIT $2`,
      [caseNumber, limit],
    )
    return rows.rows.map((r) => ({
      id: String(r.id),
      title: typeof r.court_name === 'string'
        ? `${r.court_name} — ${r.case_number}`
        : String(r.case_number ?? ''),
      caseNumber: typeof r.case_number === 'string' ? r.case_number : undefined,
      date: typeof r.date === 'string' ? r.date : undefined,
      excerpt: typeof r.summary === 'string' && r.summary.length > 0
        ? r.summary
        : typeof r.full_text_plain === 'string'
          ? r.full_text_plain.slice(0, 2000)
          : '',
      court: r.court_id
        ? { id: String(r.court_id), name: typeof r.court_name === 'string' ? r.court_name : undefined }
        : undefined,
      slug: typeof r.slug === 'string' ? r.slug : undefined,
    }))
  } catch {
    return []
  }
}
