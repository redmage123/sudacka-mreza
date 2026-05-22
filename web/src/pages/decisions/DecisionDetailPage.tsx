import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { TextToSpeech } from '@/components/TextToSpeech'

interface Decision {
  id: number; title: string; date: string;
  court?: { id: number; name: string; type: string }
  caseNumber?: string; caseType?: string; decisionType?: string;
  body?: string; content?: string; text?: string;
  fullTextPlain?: string; fullText?: string;
  summary?: string; judges?: string; outcome?: string; legalArea?: string;
  slug?: string;
  ecli?: string; celex?: string; externalUrl?: string;
}

interface NLPAnalysis {
  ner?: { courts: string[]; judges: string[]; parties: {role: string; name: string}[]; laws: string[]; articles: string[]; amounts: string[]; dates: string[]; case_numbers: string[] };
  classification?: { primary: string; topics: {topic: string; score: number}[] };
  outcome?: { outcome: string; confidence: number; details: { signals: string[] } };
  summary?: string;
  similar?: {content: string; metadata?: any; score?: number}[];
}

const NLP_BASE = '/api/nlp'

const COURT_TYPE_TO_I18N_KEY: Record<string, string> = {
  municipal: 'opcinski',
  county: 'zupanijski',
  commercial: 'trgovacki',
  misdemeanour: 'prekrsajni',
  high_commercial: 'highCommercial',
  supreme: 'vrhovni',
  administrative: 'upravni',
  constitutional: 'ustavni',
  echr: 'echr',
  ecj: 'ecj',
}

// Format raw PDF-extracted legal text into renderable blocks. Court-decision
// PDFs (HUDOC/EUR-Lex) follow a predictable shape: a header block at the top
// (court section, parties, judges), all-caps section headings, then numbered
// paragraphs. PDF extraction also leaves running headers/footers and justified-
// text artifacts (multi-space gaps inside lines, mid-sentence line breaks).
type Block =
  | { kind: 'header'; lines: string[] }
  | { kind: 'section'; text: string }
  | { kind: 'paragraph'; number?: string; text: string }

// Rejoin English ordinal suffixes that PDF extraction split onto a new line
// (e.g. "at the 1556\nth meeting" → "at the 1556th meeting"). Runs on the
// already-joined string so it also catches the case where the suffix sits at
// start of next paragraph after a soft break.
function fixOrdinalSplits(s: string): string {
  return s
    .replace(/(\d)\s*\n\s*(th|st|nd|rd)\b/gi, '$1$2')
    .replace(/(\d)\s+(th|st|nd|rd)\b/g, '$1$2')
}

// PDFs frequently extract tabular rows as a single concatenated string with no
// whitespace between columns. ECtHR resolutions in particular emit the case
// row as "<AppNo><Name><Date>" (e.g. "31454/24Ana BEROŠ18/09/2025") and the
// header row as "Application No. CaseDate of the decision". Split those back
// into one line per cell so they render readably.
const COLUMN_WORD_RE =
  /([a-zšđčćž.])(Date|Case|Name|No|Number|Title|Type|Decision|Application|Time|Place|Court|Country|Year|Article)\b/g
function unglueTableLine(line: string): string[] {
  let s = line
    // application number → start of name (digits/slash glued to a capital)
    .replace(/(\b\d{3,5}\/\d{2,4})([A-ZŠĐČĆŽ])/g, '$1\n$2')
    // end of name → date (letter glued to a dd/mm/yyyy date)
    .replace(/([A-ZŠĐČĆŽa-zšđčćž])(\d{1,2}\/\d{1,2}\/\d{4}\b)/g, '$1\n$2')
  // header column-word glue: "...Case" → "...Case", "...Date" → "... Date"
  s = s.replace(COLUMN_WORD_RE, '$1 $2')
  return s.split('\n').map((t) => t.trim()).filter(Boolean)
}

// After unglueing, ECtHR resolution tables look like:
//   "Application No. Case Date of the decision"
//   "31454/24"
//   "Ana BEROŠ"
//   "18/09/2025"
// Pair each column label with its value so the rendered output reads as
// "Application No.: 31454/24" / "Case: Ana BEROŠ" / "Date of the decision: 18/09/2025".
const APP_NO_RE = /^\d{3,5}\/\d{2,4}$/
const ECHR_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/
function pairTableRows(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const isHeader =
      /\bApplication\s+No\.?/i.test(l) &&
      /\bCase\b/.test(l) &&
      /\bDate\b/.test(l)
    if (isHeader && i + 3 < lines.length) {
      const appNo = lines[i + 1]
      const name = lines[i + 2]
      const date = lines[i + 3]
      if (APP_NO_RE.test(appNo) && ECHR_DATE_RE.test(date) && name && !APP_NO_RE.test(name) && !ECHR_DATE_RE.test(name)) {
        out.push(`Application No.: ${appNo}`)
        out.push(`Case: ${name}`)
        out.push(`Date of the decision: ${date}`)
        i += 3
        continue
      }
    }
    out.push(l)
  }
  return out
}

function formatLegalText(raw: string): Block[] {
  const lines = pairTableRows(
    fixOrdinalSplits(raw.replace(/\r/g, ''))
      .split('\n')
      .flatMap((l) => {
        const trimmed = l.replace(/[ \t]+/g, ' ').trim()
        return trimmed ? unglueTableLine(trimmed) : ['']
      }),
  )

  // Drop running headers/footers: lines that occur frequently as standalones
  // sandwiched between blanks (typical PDF page header pattern).
  const counts = new Map<string, number>()
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!l || l.length > 80 || l.length < 4) continue
    const prev = lines[i - 1] ?? ''
    const next = lines[i + 1] ?? ''
    if (prev === '' && (next === '' || /^\d{1,3}$/.test(next))) {
      counts.set(l, (counts.get(l) || 0) + 1)
    }
  }
  const runningHeaders = new Set([...counts.entries()].filter(([, n]) => n >= 3).map(([k]) => k))

  const cleaned: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (runningHeaders.has(l)) continue
    if (/^\d{1,3}$/.test(l) && (lines[i - 1] === '' || lines[i + 1] === '')) continue // bare page #
    cleaned.push(l)
  }

  // Collapse 3+ blank lines into 1
  const norm: string[] = []
  for (const l of cleaned) {
    if (l === '' && norm.length && norm[norm.length - 1] === '') continue
    norm.push(l)
  }

  const blocks: Block[] = []
  const isAllCapsHeading = (l: string) =>
    l.length > 0 &&
    l.length <= 90 &&
    /[A-ZA-Ž]/.test(l) &&
    l === l.toUpperCase() &&
    !/^\d/.test(l) &&
    !/[a-zšđčćžА-Яа-я]/.test(l) &&
    /^[A-Z0-9 ,;:.\-’'"()ŠĐČĆŽ§]+$/.test(l)

  // Pull a header block: top region until first all-caps heading or numbered para
  let i = 0
  const headerLinesRaw: string[] = []
  while (i < norm.length) {
    const l = norm[i]
    if (isAllCapsHeading(l) && headerLinesRaw.length > 2) break
    if (/^\d+\.\s/.test(l)) break
    if (l) headerLinesRaw.push(l)
    i++
    if (headerLinesRaw.length >= 14) break
  }
  // Merge soft-broken continuations within the header block. PDF extraction
  // routinely splits a single sentence ("at the 1556th meeting of the
  // Ministers' Deputies") across two lines. Heuristic: if a line doesn't end
  // with terminal punctuation and the next line starts with a lowercase
  // letter or an opening bracket-continuation, glue them together.
  const headerLines: string[] = []
  for (const l of headerLinesRaw) {
    const prev = headerLines[headerLines.length - 1]
    if (
      prev &&
      !/[.!?:;,)]\s*$/.test(prev) &&
      /^[a-zàâäéèêëïîôöùûüÿçñšđčćž(]/.test(l)
    ) {
      headerLines[headerLines.length - 1] = `${prev} ${l}`
    } else {
      headerLines.push(l)
    }
  }
  if (headerLines.length) blocks.push({ kind: 'header', lines: headerLines })

  // Body: walk remaining lines, merging continuation into paragraphs
  let buf: string[] = []
  let bufNum: string | undefined = undefined
  const flush = () => {
    if (!buf.length) return
    const text = buf.join(' ').replace(/\s+/g, ' ').trim()
    if (text) blocks.push({ kind: 'paragraph', number: bufNum, text })
    buf = []
    bufNum = undefined
  }

  // Merge a paragraph that starts mid-sentence into the previous paragraph.
  // PDF extraction frequently inserts a blank line at a hard line-break,
  // splitting a single sentence into two "paragraphs". When the next paragraph
  // starts with a lowercase letter (or with " and "/" or "/etc.) it is clearly
  // a continuation, not a new paragraph.
  const isMidSentenceStart = (text: string) =>
    /^[a-zàâäéèêëïîôöùûüÿçñšđčćž]/.test(text) ||
    /^(and|or|but|the|a|an|of|in|at|on|to|for|by|that|which|with|under|having|whereas)\s/i.test(text)

  for (; i < norm.length; i++) {
    const l = norm[i]
    if (l === '') {
      flush()
      continue
    }
    if (isAllCapsHeading(l)) {
      flush()
      blocks.push({ kind: 'section', text: l })
      continue
    }
    const m = /^(\d+)\.\s+(.*)$/.exec(l)
    if (m) {
      flush()
      bufNum = m[1]
      buf.push(m[2])
      continue
    }
    // Mid-sentence start with empty buffer + previous block was a paragraph
    // → fold into the previous paragraph instead of starting a fresh one.
    if (
      buf.length === 0 &&
      blocks.length > 0 &&
      blocks[blocks.length - 1].kind === 'paragraph' &&
      isMidSentenceStart(l)
    ) {
      const prev = blocks[blocks.length - 1] as Extract<Block, { kind: 'paragraph' }>
      prev.text = `${prev.text} ${l}`.replace(/\s+/g, ' ').trim()
      continue
    }
    buf.push(l)
  }
  flush()

  return blocks
}

const OUTCOME_LABELS: Record<string, {label: string; color: string}> = {
  plaintiff_win: { label: 'Plaintiff Won', color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' },
  plaintiff_loss: { label: 'Plaintiff Lost', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20' },
  appeal_upheld: { label: 'Appeal Upheld', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
  appeal_dismissed: { label: 'Appeal Dismissed', color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20' },
  settled: { label: 'Settled', color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
  unknown: { label: 'Unknown', color: 'text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800' },
}

// Normalize case-caption English. HUDOC + Council of Europe English texts use
// "X against Y" for the case caption ("Beroš against Croatia"). The standard
// short-form case citation in English is "X v." — render that consistently.
// Only matches when both sides are capitalized tokens to avoid touching prose
// like "decision against the applicant".
const CASE_CAPTION_RE =
  /\b([A-Z][\wŠĐČĆŽšđčćž'’-]*(?:\s+(?:and\s+Others|[A-Z][\wŠĐČĆŽšđčćž'’-]*))*)\s+against\s+([A-Z][\wŠĐČĆŽšđčćž'’-]*(?:\s+(?:and|the)\s+[A-Z][\wŠĐČĆŽšđčćž'’-]*)*)/g
function normalizeCaseCaption(s: string): string {
  return s.replace(CASE_CAPTION_RE, '$1 vs. $2')
}

// Inline markdown renderer used for legal-brief paragraphs. Recognises:
//   ~~strike~~       — verifier-flagged unverified citation
//   **bold**         — emphasised legal term
//   *italic*         — case name
//   [CELEX:NNN]      — monospace citation badge
//   [ECLI:…]         — monospace citation badge
//   [Case:Nnnn-…]    — monospace citation badge
// Also normalises "X against Y" case captions to "X vs. Y" before scanning.
const INLINE_TOKEN_RE = /(~~[^~]+~~|\*\*[^*\n]+\*\*|(?<![A-Za-z\d])\*[^*\n]{2,}?\*(?![A-Za-z\d])|\[(?:CELEX|ECLI|Case):[^\]]+\])/
function renderInline(text: string): React.ReactNode {
  const parts = normalizeCaseCaption(text).split(INLINE_TOKEN_RE)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <s
          key={i}
          className="text-red-600 dark:text-red-400 decoration-red-400"
          title="Unverified citation — could not be located in the available authorities"
        >
          {part.slice(2, -2)}
        </s>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }
    if (part.startsWith('[') && part.endsWith(']') && /^\[(CELEX|ECLI|Case):/.test(part)) {
      return (
        <span
          key={i}
          className="inline-block rounded bg-[color:var(--color-surface-subtle)] px-1.5 py-0.5 font-mono text-[0.78em] tracking-tight"
        >
          {part.slice(1, -1)}
        </span>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

// Parse an LLM-generated brief / summary into structured sections.
// LLM output shape:
//   **Heading** — opening sentence (and possibly more on same line).
//
//   Continuation paragraph...
//
//   Another continuation.
//
//   **Next Heading** — ...
type BriefSection = { heading: string; paragraphs: string[] }
function parseBrief(raw: string): { citation?: BriefSection; sections: BriefSection[] } {
  // Normalize
  const text = raw.replace(/\r/g, '').replace(/ /g, ' ')
  // Split on **Bold** at start of paragraph. Use a sentinel split so we keep
  // the heading next to its following text.
  // Match `**Heading**` at start of string OR after ANY newline (Gemma often
  // emits one section per line with no blank-line separator). Separator
  // before content is optional and may be ` — `, ` - `, `:` or whitespace.
  const HEADING_RE = /(?:^|\n)[ \t]*\*\*([^*\n]{1,80})\*\*\s*(?:[—\-:]\s*)?/g
  const parts: { matchStart: number; contentStart: number; heading: string }[] = []
  for (const m of text.matchAll(HEADING_RE)) {
    parts.push({
      matchStart: m.index!,
      contentStart: m.index! + m[0].length,
      heading: m[1].trim(),
    })
  }

  if (parts.length === 0) {
    // No headings — render as prose
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    return { sections: paragraphs.length ? [{ heading: '', paragraphs }] : [] }
  }

  const sections: BriefSection[] = []
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i].contentStart
    const end = i + 1 < parts.length ? parts[i + 1].matchStart : text.length
    const body = text.slice(start, end).trim()
    // If the section body has no blank-line breaks, render it as a single
    // paragraph (compact one-line-per-section form). Otherwise split on
    // blank lines for richer formatting.
    const paragraphs = body.includes('\n\n')
      ? body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
      : [body.replace(/\s+/g, ' ').trim()].filter(Boolean)
    sections.push({ heading: parts[i].heading, paragraphs })
  }

  // First "Citation" section gets letterhead treatment if present
  let citation: BriefSection | undefined
  if (sections[0] && /^citation/i.test(sections[0].heading)) {
    citation = sections.shift()
  }
  return { citation, sections }
}

function LegalBrief({ text, lang }: { text: string; lang: string }) {
  const { citation, sections } = parseBrief(text)
  return (
    <article
      lang={lang}
      className="legal-brief mx-auto max-w-3xl text-[color:var(--color-text)]"
      style={{
        fontFamily:
          'Georgia, "Times New Roman", "Liberation Serif", "Noto Serif", serif',
        fontSize: '0.95rem',
        lineHeight: 1.75,
      }}
    >
      {citation && (
        <header className="mb-6 border-b-2 border-[color:var(--color-border)] pb-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-text-muted)] mb-1">
            {citation.heading}
          </div>
          {citation.paragraphs.map((p, i) => (
            <p key={i} className="m-0 text-[0.95rem] leading-snug text-left" style={{ textIndent: 0 }}>
              {renderInline(p)}
            </p>
          ))}
        </header>
      )}
      {sections.map((s, si) => (
        <section key={si} className="mt-6">
          {s.heading && (
            <h2 className="mb-3 text-[0.78rem] font-bold uppercase tracking-[0.18em] text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]">
              {s.heading}
            </h2>
          )}
          {s.paragraphs.map((p, pi) => {
            // Blockquote — leading "> " on the line marks a pulled-out
            // holding or quoted statement. Render as an indented italic block
            // with a left rule for visual emphasis.
            const quoteMatch = /^>\s+(.*)$/s.exec(p)
            if (quoteMatch) {
              return (
                <blockquote
                  key={pi}
                  className="my-3 border-l-4 border-[color:var(--color-brand-gold)] bg-[color:var(--color-surface-subtle)]/40 pl-4 pr-3 py-2 italic"
                  style={{ textAlign: 'left' }}
                >
                  {renderInline(quoteMatch[1])}
                </blockquote>
              )
            }
            // Numbered legal subpoints (e.g. "1. Does the State..." inside
            // Issues / Holdings / Reasoning). Hanging indent keeps wrapped
            // lines flush with the first word.
            const numMatch = /^(\d+)\.\s+(.*)$/s.exec(p)
            if (numMatch) {
              return (
                <p key={pi} className="mb-3 pl-8 -indent-8" style={{ textAlign: 'left' }}>
                  <span className="mr-2 font-semibold tabular-nums text-[color:var(--color-brand-gold)]">
                    {numMatch[1]}.
                  </span>
                  {renderInline(numMatch[2])}
                </p>
              )
            }
            return (
              <p
                key={pi}
                className="mb-3"
                style={{ textAlign: 'left', textIndent: pi === 0 ? 0 : '1.5em' }}
              >
                {renderInline(p)}
              </p>
            )
          })}
        </section>
      ))}
    </article>
  )
}

function LegalDocument({ text, lang }: { text: string; lang: string }) {
  const blocks = formatLegalText(text)
  return (
    <article
      lang={lang}
      className="legal-document mx-auto max-w-3xl text-[color:var(--color-text)]"
      style={{
        fontFamily:
          'Georgia, "Times New Roman", "Liberation Serif", "Noto Serif", serif',
        fontSize: '0.95rem',
        lineHeight: 1.7,
      }}
    >
      {blocks.map((b, i) => {
        if (b.kind === 'header') {
          return (
            <header
              key={i}
              className="mb-6 border-b border-[color:var(--color-border)] pb-4 text-[0.9rem] text-left"
            >
              {b.lines.map((l, j) => (
                <div key={j} className={j === 0 ? 'font-semibold tracking-wide' : ''}>
                  {renderInline(l)}
                </div>
              ))}
            </header>
          )
        }
        if (b.kind === 'section') {
          return (
            <h2
              key={i}
              className="mt-8 mb-3 text-base font-bold tracking-wide text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]"
            >
              {renderInline(b.text)}
            </h2>
          )
        }
        // paragraph
        return (
          <p
            key={i}
            className="mb-3"
            style={{ textAlign: 'left', textIndent: b.number ? 0 : '1.5em' }}
          >
            {b.number ? (
              <>
                <span
                  className="mr-2 font-semibold tabular-nums text-[color:var(--color-text-muted)]"
                  style={{ minWidth: '1.5em', display: 'inline-block' }}
                >
                  {b.number}.
                </span>
                {renderInline(b.text)}
              </>
            ) : (
              renderInline(b.text)
            )}
          </p>
        )
      })}
    </article>
  )
}

export default function DecisionDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const navigate = useNavigate()
  const locale = lang ?? 'hr'
  usePageTitle('decisionDetail')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [analysis, setAnalysis] = useState<NLPAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [translated, setTranslated] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translatedTitle, setTranslatedTitle] = useState('')
  const [brief, setBrief] = useState<string>('')
  const [briefKind, setBriefKind] = useState<'summary' | 'brief' | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState<string>('')
  const [briefVerification, setBriefVerification] = useState<{
    total: number; verified: number; unverified: number;
    refs: Array<{ kind: string; ref: string; verified: boolean; source?: string }>
  } | null>(null)

  useEffect(() => {
    if (!id) return
    // /sudska-praksa/:id is a catch-all that also matches non-numeric paths
    // (anything not covered by the static /pretraga, /vts, /esljp, /ecj
    // siblings). Block early so `/api/court-decisions/NaN` never fires.
    if (!/^\d+$/.test(id)) { setError(true); setLoading(false); return }
    setLoading(true)
    setAnalysis(null)
    setTranslated('')
    setTranslatedTitle('')
    setBrief('')
    setBriefError('')
    fetch(`/api/court-decisions/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`)
        }
        return r.json()
      })
      .then(d => { setDecision(d); setLoading(false) })
      .catch((e) => {
        console.error(`[decision-load] id=${id}:`, e)
        setError(true)
        setLoading(false)
      })
  }, [id])

  // Lang-mismatch redirect for ECtHR. Some judgments are stored as two rows
  // (English + French) sharing the same caseNumber. If the user picked an
  // 'EN' locale but landed on the French row (title starts "AFFAIRE …"), find
  // the English sibling and redirect. Mirrored for FR users on the EN row.
  useEffect(() => {
    if (!decision || decision.decisionType !== 'ecthr') return
    if (!decision.caseNumber) return
    const titleIsFr = /^AFFAIRE\s/i.test(decision.title || '')
    const titleIsEn = /^CASE OF\s/i.test(decision.title || '')
    const wantFr = locale === 'fr'
    const wantEn = locale !== 'fr' && locale !== 'hr'
    const mismatch = (wantEn && titleIsFr) || (wantFr && titleIsEn)
    if (!mismatch) return
    // Payload uses camelCase field names in its REST `where` filter; fetch all
    // siblings with the same caseNumber + decisionType, then pick the row
    // whose title language matches the user locale.
    const url =
      `/api/court-decisions?where[caseNumber][equals]=${encodeURIComponent(decision.caseNumber)}` +
      `&where[decisionType][equals]=ecthr&limit=5`
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          console.error(`[lang-redirect] HTTP ${r.status} on sibling lookup for case=${decision.caseNumber}: ${body.slice(0, 200)}`)
          return null
        }
        return r.json()
      })
      .then((j: { docs?: Array<{ id: number; title?: string }> } | null) => {
        if (!j) return
        const wantPrefix = wantFr ? /^AFFAIRE\s/i : /^CASE OF\s/i
        const sibling = j.docs?.find(
          (d) => d.id !== decision.id && wantPrefix.test(d.title || ''),
        )
        if (sibling) {
          navigate(`/${locale}/sudska-praksa/${sibling.id}`, { replace: true })
        } else {
          console.warn(`[lang-redirect] no ${wantFr ? 'FR' : 'EN'} sibling for case=${decision.caseNumber} (decision id=${decision.id}); ${j.docs?.length ?? 0} candidates`)
        }
      })
      .catch((e) => {
        console.error(`[lang-redirect] sibling lookup threw for case=${decision.caseNumber}:`, e)
      })
  }, [decision, locale, navigate])

  // Auto-run NLP analysis when decision loads
  useEffect(() => {
    if (!decision?.id) return
    setAnalyzing(true)
    fetch(`${NLP_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision_id: decision.id, features: ['ner', 'classify', 'outcome'] }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          console.warn(`[nlp-analysis] HTTP ${r.status} for decision=${decision.id}: ${body.slice(0, 200)}`)
          return null
        }
        return r.json()
      })
      .then(d => { if (d?.results) setAnalysis(d.results); setAnalyzing(false) })
      .catch((e) => {
        console.error(`[nlp-analysis] threw for decision=${decision.id}:`, e)
        setAnalyzing(false)
      })
  }, [decision?.id])

  // Locale change clears the brief — it's locale-specific. Refresh fetches the
  // cached version (or generates if cache miss).
  useEffect(() => {
    setBrief('')
    setBriefKind(null)
    setBriefError('')
    setBriefVerification(null)
  }, [locale])

  // Shared fetch for both 'summary' and 'brief' kinds. Clears prior content
  // up front so the spinner shows when toggling between kinds (otherwise the
  // panel would render the previous result while the new one loads).
  const fetchBrief = useCallback(async (kind: 'summary' | 'brief') => {
    if (!decision) return
    setBriefKind(kind)
    setBrief('')
    setBriefVerification(null)
    setBriefError('')
    setBriefLoading(true)
    try {
      const r = await fetch(`/api/decisions/${decision.id}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, locale }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      const j = (await r.json()) as {
        content: string;
        verification?: { total: number; verified: number; unverified: number;
          refs: Array<{ kind: string; ref: string; verified: boolean; source?: string }> }
      }
      setBrief(j.content || '')
      setBriefVerification(j.verification ?? null)
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : `Failed to generate ${kind === 'brief' ? 'brief' : 'summary'}`)
    } finally {
      setBriefLoading(false)
    }
  }, [decision, locale])

  const handleSummary = useCallback(() => fetchBrief('summary'), [fetchBrief])
  const handleFullBrief = useCallback(() => fetchBrief('brief'), [fetchBrief])

  // Single combined translate call for title + body. Two separate effects
  // raced under React 19's auto-batching and one of the calls would silently
  // drop ~50% of the time. Now we issue one fetch with a TITLE/BODY sentinel
  // and split the response, so there's exactly one in-flight request and
  // one state update. Also detects when the model echoed the source back
  // (Maltese case) and falls back to leaving the field empty.
  const TITLE_SENTINEL = '<<<__TITLE_END__>>>'
  const isModelEchoingSource = (out: string, src: string): boolean => {
    if (!out || !src) return false
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
    return norm(out) === norm(src)
  }

  const runTranslate = useCallback(async () => {
    if (!decision) return
    if (locale === 'hr') return
    const bodyText = decision.fullTextPlain || decision.body || decision.content || decision.text || ''
    const rawTitle = (decision.title || '').trim()
    if (!bodyText && !rawTitle) return

    // ECtHR rows already have language-localized titles; the lang-redirect
    // brings the user to the matching sibling, so skip the title pass there.
    let translateTitle = !!rawTitle
    if (translateTitle && decision.decisionType === 'ecthr') {
      const titleIsEn = /^CASE OF\s/i.test(rawTitle)
      const titleIsFr = /^AFFAIRE\s/i.test(rawTitle)
      if ((locale !== 'fr' && titleIsEn) || (locale === 'fr' && titleIsFr)) {
        translateTitle = false
      }
    }

    setTranslating(true)
    const composed =
      (translateTitle ? rawTitle + '\n' + TITLE_SENTINEL + '\n' : '') +
      bodyText.substring(0, 5000)
    try {
      const resp = await fetch(`${NLP_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: composed, source: 'hr', target: locale }),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        console.warn(`[translate] HTTP ${resp.status} decision=${decision.id}: ${body.slice(0, 200)}`)
        return
      }
      const data = (await resp.json()) as { translated?: string }
      const out = (data.translated || '').trim()
      if (!out) return
      let titlePart = ''
      let bodyPart = out
      if (translateTitle && out.includes(TITLE_SENTINEL)) {
        const idx = out.indexOf(TITLE_SENTINEL)
        titlePart = out.slice(0, idx).trim()
        bodyPart = out.slice(idx + TITLE_SENTINEL.length).trim()
      } else if (translateTitle) {
        // Sentinel got eaten — fall back to first newline as a heuristic.
        const nl = out.indexOf('\n')
        if (nl > 0 && nl < 200) {
          titlePart = out.slice(0, nl).trim()
          bodyPart = out.slice(nl + 1).trim()
        }
      }
      // Guard against the model echoing the Croatian source back unchanged
      // (rare but observed for Maltese on this 9 B model).
      if (titlePart && !isModelEchoingSource(titlePart, rawTitle)) {
        setTranslatedTitle(titlePart)
      }
      if (bodyPart && !isModelEchoingSource(bodyPart, bodyText)) {
        setTranslated(bodyPart)
      }
    } catch (e) {
      console.error(`[translate] threw for decision=${decision.id}:`, e)
    }
    setTranslating(false)
  }, [decision, locale])

  // Manual button — toggles between original and translation. First press
  // fetches; second press clears (back to Croatian).
  const handleTranslate = useCallback(async () => {
    if (translated) {
      setTranslated('')
      setTranslatedTitle('')
      return
    }
    await runTranslate()
  }, [translated, runTranslate])

  // Auto-translate (title + body) the first time we land on a non-HR locale.
  useEffect(() => {
    if (!decision) return
    if (locale === 'hr') return
    if (translated || translating) return
    const bodyText = decision.fullTextPlain || decision.body || decision.content || decision.text || ''
    const hasTitle = !!(decision.title || '').trim()
    if (!bodyText && !hasTitle) return
    runTranslate()
  }, [decision, locale, translated, translating, runTranslate])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[color:var(--color-surface-subtle)] rounded w-3/4" />
          <div className="h-4 bg-[color:var(--color-surface-subtle)] rounded w-1/2" />
          <div className="h-64 bg-[color:var(--color-surface-subtle)] rounded" />
        </div>
      </div>
    )
  }

  if (error || !decision) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-[color:var(--color-heading)] mb-4">{t('decisions.notFound', 'Decision not found')}</h1>
        <p className="text-[color:var(--color-text-muted)]">{t('decisions.notFoundDescription', 'The requested court decision could not be found.')}</p>
      </div>
    )
  }

  const bodyText = decision.fullTextPlain || decision.body || decision.content || decision.text || ''
  const rawCourtName = decision.court?.name || ''
  const courtTypeKey = decision.court?.type
  const i18nKey = courtTypeKey ? COURT_TYPE_TO_I18N_KEY[courtTypeKey] : undefined
  // Translate court name with sub-tier modifier handling so compound names
  // like "Općinski građanski sud u Zagrebu" don't collapse to bare "Municipal".
  const TIER_ONLY = new Set(['echr', 'ecj', 'supreme', 'high_commercial', 'constitutional'])
  const COURT_MOD_LABEL: Record<string, string> = {
    kazneni: 'Criminal', građanski: 'Civil', gradanski: 'Civil',
    prekršajni: 'Misdemeanour', prekrsajni: 'Misdemeanour',
    radni: 'Labour', obiteljski: 'Family',
  }
  let courtName = rawCourtName
  if (locale !== 'hr' && i18nKey && rawCourtName) {
    const tierLabel = t(`courts.tab.${i18nKey}`, rawCourtName)
    if (courtTypeKey && TIER_ONLY.has(courtTypeKey)) {
      courtName = tierLabel
    } else {
      const compound = /^Općinski\s+([a-zšđčćž]+)\s+sud\s+(?:u\s+|na\s+|za\s+|-\s+)?(.+)$/i.exec(rawCourtName)
      if (compound) {
        const mod = COURT_MOD_LABEL[compound[1].toLowerCase()]
        const city = compound[2].trim()
        courtName = mod ? `${tierLabel} ${mod} — ${city}` : `${tierLabel} (${compound[1]}) — ${city}`
      } else {
        const cityStub = rawCourtName
          .replace(/^Općinski sud (u |na |za |- )?/i, '')
          .replace(/^Županijski sud (u |na |za |- )?/i, '')
          .replace(/^Trgovački sud (u |na |za |- )?/i, '')
          .replace(/^Prekršajni sud (u |na |za |- )?/i, '')
          .replace(/^Upravni sud (u |na |za |- )?/i, '')
          .trim()
        courtName = cityStub && cityStub !== rawCourtName
          ? `${tierLabel} — ${cityStub}`
          : rawCourtName
      }
    }
  }
  const outcomeInfo = analysis?.outcome ? OUTCOME_LABELS[analysis.outcome.outcome] || OUTCOME_LABELS.unknown : null

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: t('decisions.search', 'Case Law'), href: `/${locale}/sudska-praksa/pretraga` },
        { label: decision.caseNumber || (translatedTitle || decision.title)?.substring(0, 40) || `#${id}` },
      ]} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — 2/3 */}
        <div className="lg:col-span-2">
          <h1
            className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]"
            lang={translatedTitle ? locale : 'hr'}
          >
            {translatedTitle || decision.title}
          </h1>

          {/* Metadata badges */}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {courtName && (
              <Link to={`/${locale}/sudovi/${decision.court?.id || ''}`} className="inline-flex items-center gap-1 bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-full px-3 py-1 hover:border-[color:var(--color-brand-gold)] transition-colors">
                {courtName}
              </Link>
            )}
            {decision.date && (
              <span className="inline-flex items-center gap-1 bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-full px-3 py-1">
                {decision.date.split('T')[0]}
              </span>
            )}
            {decision.caseNumber && (
              <span className="inline-flex items-center bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-full px-3 py-1 font-mono text-xs">
                {decision.caseNumber}
              </span>
            )}
            {decision.ecli && (
              <span className="inline-flex items-center bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-full px-3 py-1 font-mono text-xs">
                ECLI: {decision.ecli}
              </span>
            )}
            {decision.celex && (
              <span className="inline-flex items-center bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-full px-3 py-1 font-mono text-xs">
                CELEX: {decision.celex}
              </span>
            )}
            {decision.externalUrl && (
              <a
                href={decision.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-[color:var(--color-brand)] text-white rounded-full px-3 py-1 text-xs hover:opacity-90"
              >
                {t('decisions.viewSource', 'View on source')}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
            {outcomeInfo && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium text-xs ${outcomeInfo.color}`}>
                {t(`decisions.outcome.${analysis!.outcome!.outcome}`, outcomeInfo.label)}
                {analysis!.outcome!.confidence > 0 && ` (${Math.round(analysis!.outcome!.confidence * 100)}%)`}
              </span>
            )}
            {analysis?.classification?.primary && (
              <span className="inline-flex items-center bg-[color:var(--color-brand-gold)]/10 text-[color:var(--color-brand-gold)] rounded-full px-3 py-1 font-medium text-xs">
                {t(`decisions.topic.${analysis.classification.primary}`, analysis.classification.primary)}
              </span>
            )}
          </div>

          {/* TTS + Translate buttons */}
          <div className="mt-4 flex items-center gap-3">
            {bodyText && <TextToSpeech text={bodyText.substring(0, 5000)} />}
            {bodyText && locale !== 'hr' && (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand-navy)] dark:hover:text-[color:var(--color-brand-gold)] disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
                </svg>
                {translating ? t('decisions.translating', 'Translating...') : translated ? t('decisions.showOriginal', 'Show Original') : t('decisions.translate', 'Translate')}
              </button>
            )}
            {(bodyText || decision.summary) && (
              <>
                <button
                  onClick={handleSummary}
                  disabled={briefLoading}
                  className={`inline-flex items-center gap-1.5 text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    briefKind === 'summary' && !briefError
                      ? 'text-[color:var(--color-brand-gold)] font-medium'
                      : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand-navy)] dark:hover:text-[color:var(--color-brand-gold)]'
                  }`}
                  aria-busy={briefLoading && briefKind === 'summary'}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /></svg>
                  {briefLoading && briefKind === 'summary'
                    ? t('decisions.generating', 'Generating…')
                    : t('decisions.aiSummaryAction', 'AI Summary')}
                </button>
                <button
                  onClick={handleFullBrief}
                  disabled={briefLoading}
                  className={`inline-flex items-center gap-1.5 text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    briefKind === 'brief' && !briefError
                      ? 'text-[color:var(--color-brand-gold)] font-medium'
                      : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand-navy)] dark:hover:text-[color:var(--color-brand-gold)]'
                  }`}
                  aria-busy={briefLoading && briefKind === 'brief'}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Zm5-3h8m-8 4h8m-8 4h6" /></svg>
                  {briefLoading && briefKind === 'brief'
                    ? t('decisions.generating', 'Generating…')
                    : t('decisions.fullBriefAction', 'Full Legal Brief')}
                </button>
              </>
            )}
          </div>

          {/* AI Summary / Brief panel */}
          {(brief || briefError || briefLoading) && (
            <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] p-4">
              {briefLoading ? (
                <div className="flex items-center justify-center gap-3 py-12">
                  <svg
                    className="h-6 w-6 animate-spin text-[color:var(--color-brand-gold)]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    {t('decisions.generating', 'Generating…')}
                  </p>
                </div>
              ) : briefError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{briefError}</p>
              ) : (
                <>
                  {briefVerification && briefVerification.total > 0 && (
                    <div
                      className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-subtle)] px-3 py-1 text-xs"
                      title={briefVerification.refs
                        .map(r => `${r.verified ? '✓' : '✗'} [${r.kind}:${r.ref}]${r.source ? ' ('+r.source+')' : ''}`)
                        .join('\n')}
                    >
                      <span className={briefVerification.unverified === 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'}>
                        {briefVerification.unverified === 0 ? '✓' : '⚠'}
                      </span>
                      <span>
                        {t('decisions.refsVerified', 'Verified {{verified}} of {{total}} references', {
                          verified: briefVerification.verified,
                          total: briefVerification.total,
                        })}
                      </span>
                      {briefVerification.unverified > 0 && (
                        <span className="text-[color:var(--color-text-muted)]">
                          · {t('decisions.refsUnverifiedNote', 'unverified refs are struck through')}
                        </span>
                      )}
                    </div>
                  )}
                  <LegalBrief text={brief} lang={locale} />
                </>
              )}
            </div>
          )}

          {/* Original language note */}
          {locale !== 'hr' && !translated && bodyText && (
            <p className="mt-2 text-xs text-[color:var(--color-text-muted)] italic">
              {t('decisions.originalLanguageNote', 'This decision is in its original Croatian. The Croatian text is the legally authoritative version.')}
            </p>
          )}

          {/* Decision body — full text if available, else summary fallback.
              When the user is on a non-Croatian locale we hide the original
              Croatian body until the auto-translate finishes, so the page
              never flashes Croatian before re-rendering in the target lang. */}
          {bodyText ? (
            <div className="mt-6">
              {locale !== 'hr' && translating && !translated ? (
                <div className="flex items-center justify-center gap-3 py-12">
                  <svg
                    className="h-6 w-6 animate-spin text-[color:var(--color-brand-gold)]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    {t('decisions.translating', 'Translating…')}
                  </p>
                </div>
              ) : (
                <LegalDocument
                  text={translated || bodyText}
                  lang={translated ? locale : 'hr'}
                />
              )}
            </div>
          ) : decision.summary ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] p-4 text-xs text-[color:var(--color-text-muted)]">
                {t(
                  'decisions.summaryOnlyNote',
                  'Only an official summary is available on this platform. Read the full text on the issuing court’s site.',
                )}
                {decision.decisionType === 'ecthr' && (
                  <>
                    {' '}
                    <a
                      href={`https://hudoc.echr.coe.int/eng#{%22fulltext%22:[%22${encodeURIComponent(decision.title || '')}%22]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[color:var(--color-brand-gold)] hover:opacity-80"
                    >
                      HUDOC
                    </a>
                  </>
                )}
                {decision.decisionType === 'ecj' && decision.celex && (
                  <>
                    {' '}
                    <a
                      href={`https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${encodeURIComponent(decision.celex)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[color:var(--color-brand-gold)] hover:opacity-80"
                    >
                      EUR-Lex
                    </a>
                  </>
                )}
              </div>
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text)]"
                lang={'hr'}
              >
                {decision.summary}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center py-8 bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] rounded-lg">
              <p className="text-[color:var(--color-text-muted)]">{t('decisions.noFullText', 'Full text not yet available.')}</p>
            </div>
          )}
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          {/* NER Entities */}
          {analysis?.ner && (
            <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)] mb-3">
                {t('decisions.entities', 'Key Entities')}
              </h3>

              {analysis.ner.parties && analysis.ner.parties.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.parties', 'Parties')}</p>
                  {analysis.ner.parties.map((p, i) => (
                    <p key={i} className="text-sm"><span className="text-[color:var(--color-brand-gold)] text-xs">{p.role}</span> {p.name}</p>
                  ))}
                </div>
              )}

              {analysis.ner.courts && analysis.ner.courts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.courts', 'Courts')}</p>
                  {analysis.ner.courts.map((c, i) => <p key={i} className="text-sm">{c}</p>)}
                </div>
              )}

              {analysis.ner.laws && analysis.ner.laws.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.laws', 'Laws Referenced')}</p>
                  {analysis.ner.laws.map((l, i) => <p key={i} className="text-sm">{l}</p>)}
                </div>
              )}

              {analysis.ner.articles && analysis.ner.articles.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.articles', 'Articles')}</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.ner.articles.map((a, i) => (
                      <span key={i} className="text-xs bg-[color:var(--color-surface-subtle)] rounded px-2 py-0.5">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.ner.amounts && analysis.ner.amounts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.amounts', 'Amounts')}</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.ner.amounts.slice(0, 10).map((a, i) => (
                      <span key={i} className="text-xs font-mono bg-[color:var(--color-surface-subtle)] rounded px-2 py-0.5">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.ner.case_numbers && analysis.ner.case_numbers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[color:var(--color-text-muted)] mb-1">{t('decisions.relatedCases', 'Related Cases')}</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.ner.case_numbers.map((cn, i) => (
                      <span key={i} className="text-xs font-mono bg-[color:var(--color-surface-subtle)] rounded px-2 py-0.5">{cn}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Summary — only render when one is available */}
          {analysis?.summary && (
            <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)] mb-2">
                {t('decisions.aiSummary', 'AI Summary')}
              </h3>
              <p className="text-sm">{analysis.summary}</p>
            </div>
          )}

          {/* Loading indicator */}
          {analyzing && (
            <div className="text-center py-2">
              <p className="text-xs text-[color:var(--color-text-muted)] animate-pulse">{t('decisions.analyzing', 'Analyzing decision...')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
