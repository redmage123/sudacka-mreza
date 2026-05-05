// AI Summary + Full Legal Brief generator for court decisions.
//
// POST /api/decisions/:id/brief
//   body: { kind: 'summary' | 'brief', locale: string }
//   returns: { content: string, generatedAt: string, fromCache: boolean,
//              kind, locale }
//
// Output is cached per (decisionId, kind, locale) in the decision_briefs
// table; subsequent requests are served from cache. The summary is a tight
// IRAC-style abstract (~250 words). The full brief (Phase 2) will be a
// retrieval-augmented IRAC analysis with verified statute/case citations.

import { Router } from 'express'
import type { Payload } from 'payload'
import crypto from 'node:crypto'

const OLLAMA_BASE = (process.env.LLM_ENDPOINT || 'http://176.9.99.103:11434/v1/chat/completions')
  .replace(/\/v1\/chat\/completions$/, '')
const CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`
const LLM_MODEL = process.env.LLM_MODEL || 'gemma-4-e4b-eurlex-v1'
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || ''

// Map ISO locale → spoken language name + script note. Used in the prompt so
// the model writes in the right script (Cyrillic for bg/uk, CJK for ja/zh,
// Arabic for ar, etc.) rather than transliterating.
const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic (Arabic script)',
  bg: 'Bulgarian (Cyrillic script)',
  cs: 'Czech',
  da: 'Danish',
  de: 'German',
  el: 'Greek (Greek script)',
  en: 'English',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  hr: 'Croatian',
  hu: 'Hungarian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese (Japanese script)',
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
  uk: 'Ukrainian (Cyrillic script)',
  zh: 'Chinese (Simplified, Han characters)',
}

interface PgPool {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>
}

function pool(payload: Payload): PgPool {
  return (payload.db as unknown as { pool: PgPool }).pool
}

let schemaReady = false
async function ensureSchema(p: PgPool): Promise<void> {
  if (schemaReady) return
  await p.query(`
    CREATE TABLE IF NOT EXISTS decision_briefs (
      decision_id   INTEGER NOT NULL,
      kind          TEXT NOT NULL,
      locale        TEXT NOT NULL,
      content       TEXT NOT NULL,
      source_hash   TEXT NOT NULL,
      generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (decision_id, kind, locale)
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

interface DecisionRow {
  id: number
  title: string | null
  case_number: string | null
  decision_type: string | null
  date: Date | null
  full_text_plain: string | null
  summary: string | null
}

async function loadDecision(p: PgPool, id: number): Promise<DecisionRow | null> {
  const r = await p.query<DecisionRow>(
    `SELECT id, title, case_number, decision_type, date, full_text_plain, summary
     FROM court_decisions WHERE id = $1 LIMIT 1`,
    [id],
  )
  return r.rows[0] || null
}

function summaryPrompt(d: DecisionRow, langName: string, body: string): string {
  return [
    `You are a senior Croatian legal analyst writing a concise case brief in ${langName}.`,
    'Output is rendered as a professional legal document. Follow the formatting rules strictly.',
    '',
    '## STRUCTURE',
    'Use these six sections in this exact order. Each heading is on its own line as `**Heading** —` with the title translated into the target language. Insert ONE blank line between sections.',
    '',
    '1. **Citation** — case number, court, date. Single line.',
    '2. **Facts** — 2–4 sentences on procedural posture and material facts.',
    '3. **Issue** — the precise legal question(s) decided. If multiple, use a numbered list (`1.`, `2.`).',
    '4. **Holding** — the court\'s answer to each issue. Lead with `> ` (blockquote).',
    '5. **Reasoning** — 3–6 sentences on the legal logic. Italicize cited case names with `*Case Name*`. Bold critical legal terms with `**term**`. Keep article references verbatim.',
    '6. **Disposition** — what the court actually ordered, in one sentence.',
    '',
    '## STYLE',
    `- Reply ONLY in ${langName}.`,
    '- Target length: 220–320 words total.',
    '- Preserve verbatim: case numbers (e.g. Pp-4159/2024-5), ECLI codes, CELEX numbers, statute names (Kazneni zakon, ZOO, ZPP, Ustav, Direktiva 2006/112/EC), article references (e.g. čl. 230. KZ, art. 138 VAT Directive), court names, OIB numbers, dates.',
    '- Do not invent facts, parties, dates, statutes, or citations not present in the source.',
    '- Never repeat a sentence verbatim.',
    '',
    `--- DECISION (Croatian) ---`,
    `Case number: ${d.case_number || ''}`,
    `Decision type: ${d.decision_type || ''}`,
    `Date: ${d.date ? new Date(d.date).toISOString().slice(0, 10) : ''}`,
    `Title: ${d.title || ''}`,
    '',
    body,
  ].join('\n')
}

const MAX_BODY_CHARS = 18000  // ~4–5K tokens of source body, fits 8192 ctx

const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text'

interface CitationHit {
  source: 'eurlex' | 'court'
  ref: string         // CELEX or case-number/ECLI
  title: string
  snippet: string
  scope?: string      // 'caselaw' | 'legislation' (for eurlex)
  date?: string
}

async function embedText(text: string): Promise<number[] | null> {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { embeddings?: number[][] }
    return j.embeddings?.[0] ?? null
  } catch {
    return null
  }
}

const pgVecLit = (v: number[]) => `[${v.join(',')}]`

interface EurlexRow {
  celex: string
  scope: string
  date: Date | null
  title: string
  chunk_text: string
}
interface CourtRow {
  id: number
  title: string | null
  case_number: string | null
  date: Date | null
  full_text_plain: string | null
  summary: string | null
}

async function retrieveCitations(p: PgPool, d: DecisionRow, lang: string): Promise<CitationHit[]> {
  const out: CitationHit[] = []
  const probe = (d.title || '') + '\n\n' + (d.full_text_plain || d.summary || '').slice(0, 2000)
  const v = await embedText(probe)

  if (v) {
    // Top-K from EUR-Lex titles via pgvector cosine. Prefer same-lang where
    // available, fall back to EN for languages we don't have HR coverage on.
    const langPref = lang === 'hr' ? 'hr' : 'en'
    const eurlex = await p.query<EurlexRow>(
      `SELECT celex, scope, date, title, chunk_text
       FROM eurlex_docs
       WHERE lang IN ($2, 'en') AND chunk_idx = 0
       ORDER BY embedding <=> $1::vector ASC, (lang = $2)::int DESC
       LIMIT 6`,
      [pgVecLit(v), langPref],
    )
    for (const row of eurlex.rows) {
      out.push({
        source: 'eurlex',
        ref: row.celex,
        title: row.title || '',
        snippet: (row.chunk_text || '').slice(0, 280),
        scope: row.scope,
        date: row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined,
      })
    }
  }

  // Top similar prior decisions from court_decisions via FTS (best-effort)
  const fts = (d.title || '').replace(/['’]/g, '').slice(0, 200)
  if (fts) {
    try {
      const courts = await p.query<CourtRow>(
        `SELECT id, title, case_number, date,
                substring(full_text_plain, 1, 280) AS full_text_plain,
                substring(summary, 1, 280) AS summary
         FROM court_decisions
         WHERE id <> $2
           AND search_vector @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank(search_vector, plainto_tsquery('simple', $1)) DESC,
                  date DESC NULLS LAST
         LIMIT 4`,
        [fts, d.id],
      )
      for (const row of courts.rows) {
        out.push({
          source: 'court',
          ref: row.case_number || `decision#${row.id}`,
          title: row.title || '',
          snippet: (row.full_text_plain || row.summary || '').slice(0, 280),
          date: row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined,
        })
      }
    } catch {
      // search_vector or column may not exist on this deployment — continue
      // with eurlex hits only
    }
  }
  return out
}

interface VerifiedRef {
  raw: string                // exact substring as it appears in the brief
  kind: 'celex' | 'ecli' | 'case'
  ref: string                // normalized ref
  verified: boolean
  source?: 'eurlex' | 'court_decisions' | 'decision_body'
}

const CELEX_RE = /\[CELEX:([0-9A-Z]{8,})\]/g
const ECLI_RE = /\[ECLI:([0-9A-Z:.\-/]{8,})\]/g
const CASE_RE = /\[Case:([^\]]{2,40})\]/g

async function verifyCitations(p: PgPool, d: DecisionRow, content: string): Promise<VerifiedRef[]> {
  const refs: VerifiedRef[] = []
  const seen = new Set<string>()
  const sourceText = ((d.title || '') + '\n' + (d.full_text_plain || d.summary || '')).toUpperCase()

  for (const m of content.matchAll(CELEX_RE)) {
    const raw = m[0]
    const ref = m[1].toUpperCase()
    if (seen.has(`celex:${ref}`)) continue
    seen.add(`celex:${ref}`)
    refs.push({ raw, kind: 'celex', ref, verified: false })
  }
  for (const m of content.matchAll(ECLI_RE)) {
    const raw = m[0]
    const ref = m[1].toUpperCase()
    if (seen.has(`ecli:${ref}`)) continue
    seen.add(`ecli:${ref}`)
    refs.push({ raw, kind: 'ecli', ref, verified: false })
  }
  for (const m of content.matchAll(CASE_RE)) {
    const raw = m[0]
    const ref = m[1].trim()
    if (seen.has(`case:${ref}`)) continue
    seen.add(`case:${ref}`)
    refs.push({ raw, kind: 'case', ref, verified: false })
  }

  for (const r of refs) {
    if (r.kind === 'celex') {
      // Source-body lookup
      if (sourceText.includes(r.ref)) {
        r.verified = true; r.source = 'decision_body'; continue
      }
      const hit = await p.query(
        `SELECT 1 FROM eurlex_docs WHERE celex = $1 LIMIT 1`,
        [r.ref],
      )
      if (hit.rows.length) { r.verified = true; r.source = 'eurlex' }
    } else if (r.kind === 'ecli') {
      if (sourceText.includes(r.ref)) {
        r.verified = true; r.source = 'decision_body'; continue
      }
      // court_decisions stores ecli loosely — try exact + LIKE
      const hit = await p.query(
        `SELECT 1 FROM court_decisions WHERE ecli = $1 OR ecli ILIKE $2 LIMIT 1`,
        [r.ref, `%${r.ref}%`],
      )
      if (hit.rows.length) { r.verified = true; r.source = 'court_decisions' }
    } else {
      // case number / decision number
      if (sourceText.includes(r.ref.toUpperCase())) {
        r.verified = true; r.source = 'decision_body'; continue
      }
      const hit = await p.query(
        `SELECT 1 FROM court_decisions WHERE case_number = $1 LIMIT 1`,
        [r.ref],
      )
      if (hit.rows.length) { r.verified = true; r.source = 'court_decisions' }
    }
  }

  return refs
}

function applyVerificationMarkup(content: string, refs: VerifiedRef[]): string {
  // Wrap unverified refs in ~~strikethrough~~. Verified refs keep their raw form;
  // the frontend can style them differently if it wants based on the refs list.
  let out = content
  for (const r of refs) {
    if (!r.verified) {
      out = out.split(r.raw).join(`~~${r.raw}~~`)
    }
  }
  return out
}

function briefPrompt(d: DecisionRow, langName: string, body: string, hits: CitationHit[]): string {
  const refsBlock = hits.length === 0
    ? '(no retrieved authorities)'
    : hits.map((h, i) => {
        const tag = h.source === 'eurlex'
          ? `[CELEX:${h.ref}]${h.scope === 'legislation' ? ' (legislation)' : ' (case law)'}`
          : `[Case:${h.ref}]`
        return `${i + 1}. ${tag} ${h.date || ''} — ${h.title}\n   ${h.snippet}`
      }).join('\n\n')

  return [
    `You are a senior Croatian legal scholar writing a comprehensive legal brief in ${langName}.`,
    'Output is rendered as a professional legal document. Follow the formatting rules strictly.',
    '',
    '## STRUCTURE',
    'Use these eight sections in this exact order. Each heading is on its own line as `**Heading** —` with the title translated into the target language. Insert ONE blank line between sections.',
    '',
    '1. **Citation** — case number, court, date, ECLI/CELEX if known. Single line.',
    '2. **Procedural Posture** — how the case arrived at this court (2–3 short paragraphs).',
    '3. **Facts** — material facts (2–4 short paragraphs).',
    '4. **Issues Presented** — numbered list. Each issue starts with `1.`, `2.`, … on its own line, framed as a yes/no legal question.',
    '5. **Holdings** — numbered to match Issues. Lead each holding with `> ` (blockquote) so it is visually pulled out.',
    '6. **Reasoning** — numbered analytical paragraphs. Lead each paragraph with `1. `, `2. `, … Each paragraph 3–6 sentences. Cite every authority inline using `[CELEX:NNNNNNNN]`, `[ECLI:…]`, or `[Case:Nnnn-NN/YYYY]`. Cite ONLY from the "Retrieved Authorities" list below or from refs verbatim in the decision body. Italicize case names with `*Mlinarević vs. Croatia*` style. Bold critical legal terms with `**term**`.',
    '7. **Disposition** — single paragraph stating exactly what the court ordered.',
    '8. **Significance** — single paragraph on precedential or doctrinal weight.',
    '',
    '## STYLE',
    `- Reply ONLY in ${langName}.`,
    '- Target length: 900–1500 words.',
    '- Short paragraphs (3–6 sentences). Never produce a multi-paragraph blob under one heading without numbering.',
    '- Preserve verbatim: case numbers, ECLI codes, CELEX numbers, statute names, article references, court names, OIB numbers, dates, party names.',
    '- Do not invent facts, parties, statutes, or citations. When uncertain, omit.',
    '- Never repeat a sentence verbatim. State each finding once.',
    '',
    `--- DECISION ---`,
    `Case number: ${d.case_number || ''}`,
    `Decision type: ${d.decision_type || ''}`,
    `Date: ${d.date ? new Date(d.date).toISOString().slice(0, 10) : ''}`,
    `Title: ${d.title || ''}`,
    '',
    body,
    '',
    `--- RETRIEVED AUTHORITIES (cite only from these or from refs verbatim in the decision body above) ---`,
    refsBlock,
  ].join('\n')
}

export function createDecisionBriefRouter(payload: Payload): Router {
  const router = Router()
  const p = pool(payload)

  router.post('/decisions/:id/brief', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })

    const body = (req.body || {}) as { kind?: string; locale?: string; force?: boolean }
    const kind = body.kind === 'brief' ? 'brief' : 'summary'
    const locale = (body.locale || 'hr').toLowerCase()
    const langName = LANG_NAMES[locale] || LANG_NAMES.en

    try {
      await ensureSchema(p)
    } catch (e) {
      payload.logger?.error?.(`decisionBrief.ensureSchema: ${e instanceof Error ? e.message : String(e)}`)
      return res.status(500).json({ error: 'schema init failed' })
    }

    const decision = await loadDecision(p, id)
    if (!decision) return res.status(404).json({ error: 'decision not found' })

    const sourceText = (decision.full_text_plain || decision.summary || '').trim()
    if (!sourceText || sourceText.length < 200) {
      return res.status(422).json({ error: 'decision has no body to summarize' })
    }
    const truncated = sourceText.length > MAX_BODY_CHARS ? sourceText.slice(0, MAX_BODY_CHARS) : sourceText
    const sourceHash = hashText(truncated)

    // Cache lookup — same source text + same locale + same kind
    if (!body.force) {
      const cached = await p.query<{ content: string; generated_at: Date; source_hash: string }>(
        `SELECT content, generated_at, source_hash FROM decision_briefs
         WHERE decision_id = $1 AND kind = $2 AND locale = $3 LIMIT 1`,
        [id, kind, locale],
      )
      if (cached.rows.length && cached.rows[0].source_hash === sourceHash) {
        return res.json({
          content: cached.rows[0].content,
          generatedAt: cached.rows[0].generated_at,
          fromCache: true,
          kind, locale,
        })
      }
    }

    // Build prompt — summary or retrieval-augmented brief
    let prompt: string
    let citations: CitationHit[] = []
    let numPredict = 700
    let timeoutMs = 60_000
    if (kind === 'brief') {
      citations = await retrieveCitations(p, decision, locale)
      prompt = briefPrompt(decision, langName, truncated, citations)
      numPredict = 2200
      timeoutMs = 180_000
    } else {
      prompt = summaryPrompt(decision, langName, truncated)
    }

    // Detect a sampling collapse. Gemma can lock on either a short structured
    // token ("ECLI:") or, with a stronger repeat_penalty, on whole sentences
    // / clauses (~150–200 chars). We scan for any substring 2..220 chars
    // long repeated 6+ consecutive times AND for 3+ consecutive identical
    // long sentences, returning the earliest cut point.
    const detectDegeneracy = (s: string): { ok: boolean; trimmedAt?: number } => {
      const sub = s.match(/(.{2,220}?)\1{5,}/s)
      let earliest: number | undefined
      if (sub && typeof sub.index === 'number') earliest = sub.index
      const sentences = [...s.matchAll(/[^.!?\n]{40,}[.!?]/g)]
      for (let i = 0; i + 2 < sentences.length; i++) {
        const a = sentences[i][0].trim()
        const b = sentences[i + 1][0].trim()
        const c = sentences[i + 2][0].trim()
        if (a === b && b === c) {
          const at = sentences[i].index ?? 0
          if (earliest === undefined || at < earliest) earliest = at
          break
        }
      }
      return earliest === undefined ? { ok: true } : { ok: false, trimmedAt: earliest }
    }
    const callLlm = async (
      repeatPenalty: number,
      temperature: number,
    ): Promise<string> => {
      const r = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: llmHeaders(),
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: 'You write accurate, formally structured legal case briefs. You never invent facts, parties, or citations. You always reply in the exact language requested. Each citation appears exactly once; never repeat the same citation token. Never repeat a sentence verbatim. State each finding once, then move on.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          think: false,
          options: {
            temperature,
            top_p: 0.9,
            top_k: 40,
            num_ctx: 8192,
            num_predict: numPredict,
            repeat_penalty: repeatPenalty,
            repeat_last_n: 512,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = (await r.json()) as { message?: { content?: string } }
      return (j.message?.content || '').trim().replace(/^[`"']+|[`"']+$/g, '').trim()
    }

    let content = ''
    let degenerated = false
    try {
      content = await callLlm(1.3, 0.4)
      let check = detectDegeneracy(content)
      if (!check.ok) {
        payload.logger?.warn?.(`decisionBrief.degeneracy: pass1 collapsed at ${check.trimmedAt} for decision=${id}, retrying`)
        const retry = await callLlm(1.6, 0.6)
        let retryCheck = detectDegeneracy(retry)
        if (retryCheck.ok) {
          content = retry
        } else {
          // Third attempt: very high temperature + low repeat-penalty bias —
          // last-resort sampling that often escapes degenerate attractors.
          payload.logger?.warn?.(`decisionBrief.degeneracy: pass2 collapsed at ${retryCheck.trimmedAt} for decision=${id}, last-resort retry`)
          const retry2 = await callLlm(1.8, 0.85)
          const retry2Check = detectDegeneracy(retry2)
          if (retry2Check.ok) {
            content = retry2
          } else {
            // All three attempts collapsed — pick the longest clean prefix.
            const cuts = [
              { c: content, at: check.trimmedAt ?? content.length },
              { c: retry, at: retryCheck.trimmedAt ?? retry.length },
              { c: retry2, at: retry2Check.trimmedAt ?? retry2.length },
            ].sort((a, b) => b.at - a.at)
            content = cuts[0].c.slice(0, cuts[0].at).trim()
            degenerated = true
            payload.logger?.warn?.(`decisionBrief.degeneracy: salvaged ${content.length} chars after 3 collapsed attempts for decision=${id}`)
          }
        }
      }
    } catch (e) {
      payload.logger?.error?.(`decisionBrief.llm: ${e instanceof Error ? e.message : String(e)}`)
      return res.status(502).json({ error: 'LLM call failed' })
    }
    // Graceful fallback when the LLM can't produce useful output for this
    // decision (typically because the input body is too short and the model
    // collapses immediately). Surface the source summary itself so the user
    // sees something legible instead of an error.
    if (!content || content.length < 120) {
      const fallback = (decision.summary || '').trim()
      if (fallback.length >= 80) {
        const note = degenerated
          ? '_AI brief generation collapsed for this decision. Showing the official summary._'
          : '_The AI model returned no usable output. Showing the official summary._'
        content = `**Citation** — ${decision.case_number || ''} ${decision.title || ''}\n\n**Summary** — ${fallback}\n\n${note}`
      } else {
        return res.status(502).json({ error: 'empty LLM response' })
      }
    }

    // Phase 3 — verify citations against the local DB. Mark unverified inline.
    let verifiedRefs: VerifiedRef[] = []
    if (kind === 'brief') {
      try {
        verifiedRefs = await verifyCitations(p, decision, content)
        content = applyVerificationMarkup(content, verifiedRefs)
      } catch (e) {
        payload.logger?.error?.(`decisionBrief.verify: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Persist
    await p.query(
      `INSERT INTO decision_briefs (decision_id, kind, locale, content, source_hash, generated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (decision_id, kind, locale) DO UPDATE
       SET content = EXCLUDED.content, source_hash = EXCLUDED.source_hash, generated_at = NOW()`,
      [id, kind, locale, content, sourceHash],
    )

    const verifiedCount = verifiedRefs.filter((r) => r.verified).length
    return res.json({
      content, generatedAt: new Date(), fromCache: false, kind, locale,
      citations: kind === 'brief' ? citations.map((c) => ({
        source: c.source, ref: c.ref, title: c.title, scope: c.scope, date: c.date,
      })) : undefined,
      verification: kind === 'brief' ? {
        total: verifiedRefs.length,
        verified: verifiedCount,
        unverified: verifiedRefs.length - verifiedCount,
        refs: verifiedRefs.map((r) => ({ kind: r.kind, ref: r.ref, verified: r.verified, source: r.source })),
      } : undefined,
    })
  })

  return router
}
