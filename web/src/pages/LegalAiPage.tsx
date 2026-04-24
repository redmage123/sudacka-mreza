import { useState, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

// ---------------------------------------------------------------------------
// Types mirror the /api/legal-ai/ask response (which in turn mirrors the
// FastAPI /ask schema from scripts/24_serve.py).  Kept inline — if the schema
// stabilises, promote to a shared types package.
// ---------------------------------------------------------------------------

type AskStatus =
  | 'answered'
  | 'flagged'
  | 'flagged_nli'
  | 'refused_by_model'
  | 'refused_low_retrieval'
  | 'llm_error'

interface Passage {
  index: number
  chunk_id: string
  source_id: string
  kind: 'legislation' | 'decision' | 'commentary' | 'other'
  title: string
  url: string
  text: string
  case_number?: string | null
  article_number?: string | null
}

interface Verification {
  citations_valid: boolean
  cited_indices: number[]
  invalid_citations: number[]
  entities_grounded: boolean
  ungrounded_entities: string[]
  grounded_entities: string[]
}

interface NliSummary {
  faithful: boolean
  n_claims: number
  n_supported: number
  n_partial: number
  n_unsupported: number
  n_neutral: number
  claim_checks: Array<{
    sentence: string
    verdict: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'NEUTRAL' | 'PARSE_ERROR'
    cited_indices: number[]
  }>
}

interface AskResponse {
  question: string
  answer: string
  status: AskStatus
  passages: Passage[]
  trustworthy: boolean
  retrieval: { confident: boolean; reason: string; max_dense: number; max_bm25: number }
  verification: Verification | null
  nli: NliSummary | null
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function statusToneClass(status: AskStatus): string {
  switch (status) {
    case 'answered':
      return 'bg-green-50 text-green-900 border-green-200'
    case 'flagged':
    case 'flagged_nli':
      return 'bg-amber-50 text-amber-900 border-amber-300'
    case 'refused_by_model':
    case 'refused_low_retrieval':
      return 'bg-slate-50 text-slate-800 border-slate-200'
    case 'llm_error':
      return 'bg-red-50 text-red-900 border-red-300'
  }
}

/** Render an answer, turning [N] markers into clickable links that jump to the
 *  matching passage card. */
function renderAnswerWithCitations(
  answer: string,
  onJump: (idx: number) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\[(\d+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(answer)) !== null) {
    if (m.index > last) parts.push(answer.slice(last, m.index))
    const idx = Number(m[1])
    parts.push(
      <button
        key={`cit-${m.index}`}
        type="button"
        onClick={() => onJump(idx)}
        className="inline-block rounded bg-[color:var(--color-brand-navy)] px-1.5 py-0 mx-0.5 text-xs font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-navy)]"
        aria-label={`Pogledaj pasus ${idx}`}
      >
        [{idx}]
      </button>,
    )
    last = m.index + m[0].length
  }
  if (last < answer.length) parts.push(answer.slice(last))
  return parts
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LegalAiPage() {
  const { t } = useTranslation('legalAi')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (q.length < 3) {
      setError(t('errors.tooShort'))
      return
    }
    if (q.length > 2000) {
      setError(t('errors.tooLong'))
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/legal-ai/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (res.status === 429) {
        setError(t('errors.rateLimit'))
        return
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        setError(detail?.error || t('errors.network'))
        return
      }
      const data: AskResponse = await res.json()
      setResult(data)
    } catch {
      setError(t('errors.network'))
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setQuestion('')
    setResult(null)
    setError(null)
  }

  function jumpToPassage(idx: number) {
    const el = document.getElementById(`passage-${idx}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.setAttribute('data-highlight', '1')
      setTimeout(() => el.removeAttribute('data-highlight'), 1800)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[color:var(--color-brand-navy)] mb-3">
          {t('title')}
        </h1>
        <p className="text-[color:var(--color-text-muted)] mb-3">{t('lead')}</p>
        <p className="text-sm italic text-[color:var(--color-text-muted)] border-l-4 border-amber-300 bg-amber-50 px-4 py-3 rounded">
          {t('disclaimer')}
        </p>
      </header>

      <form onSubmit={submit} className="mb-8">
        <label htmlFor="q" className="sr-only">
          {t('title')}
        </label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('placeholder')}
          rows={3}
          disabled={loading}
          className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-base shadow-sm focus:border-[color:var(--color-brand-navy)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-navy)] disabled:opacity-60"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="submit"
            disabled={loading || question.trim().length < 3}
            className="rounded-md bg-[color:var(--color-brand-navy)] px-5 py-2 text-white font-semibold shadow hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? t('submitting') : t('submit')}
          </button>
          {(result || error) && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-[color:var(--color-border)] px-4 py-2 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)]"
            >
              {t('clear')}
            </button>
          )}
        </div>
      </form>

      {error && (
        <div role="alert" className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-900">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Status */}
          <div
            className={`mb-6 rounded border px-4 py-3 text-sm font-medium ${statusToneClass(result.status)}`}
          >
            {t(`status.${result.status}`)}
          </div>

          {/* Answer */}
          {result.answer && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-3 text-[color:var(--color-brand-navy)]">
                {t('answerHeading')}
              </h2>
              <div className="prose max-w-none whitespace-pre-wrap text-[color:var(--color-text)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md p-4 leading-relaxed">
                {renderAnswerWithCitations(result.answer, jumpToPassage)}
              </div>
            </section>
          )}

          {/* Verification */}
          {result.verification && (
            <section className="mb-8 text-sm">
              <h3 className="font-semibold mb-2 text-[color:var(--color-text-muted)]">
                {t('verification.heading')}
              </h3>
              <ul className="space-y-1">
                <li>
                  {result.verification.citations_valid ? (
                    <span className="text-green-700">✓ {t('verification.citationsValid')}</span>
                  ) : (
                    <span className="text-amber-700">
                      ⚠ {t('verification.citationsInvalid', { list: result.verification.invalid_citations.join(', ') })}
                    </span>
                  )}
                </li>
                <li>
                  {result.verification.entities_grounded ? (
                    <span className="text-green-700">✓ {t('verification.entitiesGrounded')}</span>
                  ) : (
                    <span className="text-amber-700">
                      ⚠ {t('verification.ungrounded', { list: result.verification.ungrounded_entities.join(', ') })}
                    </span>
                  )}
                </li>
                {result.nli && (
                  <>
                    <li className="text-green-700">
                      ✓ {t('verification.nliSupported', { n: result.nli.n_supported })}
                    </li>
                    {result.nli.n_partial > 0 && (
                      <li className="text-amber-700">
                        ⚠ {t('verification.nliPartial', { n: result.nli.n_partial })}
                      </li>
                    )}
                    {result.nli.n_unsupported > 0 && (
                      <li className="text-red-700">
                        ✗ {t('verification.nliUnsupported', { n: result.nli.n_unsupported })}
                      </li>
                    )}
                    {result.nli.n_neutral > 0 && (
                      <li className="text-[color:var(--color-text-muted)]">
                        · {t('verification.nliNeutral', { n: result.nli.n_neutral })}
                      </li>
                    )}
                  </>
                )}
              </ul>
            </section>
          )}

          {/* Sources */}
          <section>
            <h2 className="text-xl font-semibold mb-2 text-[color:var(--color-brand-navy)]">
              {t('sourcesHeading')}
            </h2>
            <p className="mb-4 text-sm text-[color:var(--color-text-muted)]">
              {t('sourcesHint')}
            </p>
            {result.passages.length === 0 ? (
              <p className="italic text-[color:var(--color-text-muted)]">{t('noSources')}</p>
            ) : (
              <ul className="space-y-3">
                {result.passages.map((p) => (
                  <li
                    key={p.chunk_id}
                    id={`passage-${p.index}`}
                    className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition-colors data-[highlight=1]:bg-amber-50"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <span className="inline-block rounded bg-[color:var(--color-brand-navy)] px-1.5 py-0.5 text-xs font-bold text-white mr-2">
                          [{p.index}]
                        </span>
                        <span className="text-xs uppercase tracking-wide font-semibold text-[color:var(--color-text-muted)] mr-2">
                          {p.kind}
                        </span>
                        <span className="font-semibold">{p.title}</span>
                        {p.case_number && (
                          <span className="ml-2 text-xs font-mono text-[color:var(--color-text-muted)]">
                            {p.case_number}
                          </span>
                        )}
                      </div>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[color:var(--color-brand-navy)] hover:underline whitespace-nowrap"
                        >
                          {t('openSource')} ↗
                        </a>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-[color:var(--color-text)]">
                      {p.text}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
