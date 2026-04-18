import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router'
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

const OUTCOME_LABELS: Record<string, {label: string; color: string}> = {
  plaintiff_win: { label: 'Plaintiff Won', color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' },
  plaintiff_loss: { label: 'Plaintiff Lost', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20' },
  appeal_upheld: { label: 'Appeal Upheld', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
  appeal_dismissed: { label: 'Appeal Dismissed', color: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20' },
  settled: { label: 'Settled', color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
  unknown: { label: 'Unknown', color: 'text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800' },
}

export default function DecisionDetailPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang, id } = useParams<{ lang: string; id: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('decisionDetail')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [analysis, setAnalysis] = useState<NLPAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [translated, setTranslated] = useState('')
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setAnalysis(null)
    setTranslated('')
    fetch(`/api/court-decisions/${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(d => { setDecision(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  // Auto-run NLP analysis when decision loads
  useEffect(() => {
    if (!decision?.id) return
    setAnalyzing(true)
    fetch(`${NLP_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision_id: decision.id, features: ['ner', 'classify', 'outcome'] }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.results) setAnalysis(d.results); setAnalyzing(false) })
      .catch(() => setAnalyzing(false))
  }, [decision?.id])

  const handleTranslate = useCallback(async () => {
    if (!decision) return
    const bodyText = decision.fullTextPlain || decision.body || decision.content || decision.text || ''
    if (!bodyText || locale === 'hr') return

    if (translated) { setTranslated(''); return }

    setTranslating(true)
    try {
      const resp = await fetch(`${NLP_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bodyText.substring(0, 5000), source: 'hr', target: locale }),
      })
      if (resp.ok) {
        const data = await resp.json()
        setTranslated(data.translated || '')
      }
    } catch { /* translation not available */ }
    setTranslating(false)
  }, [decision, locale, translated])

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
  const courtName = decision.court?.name || ''
  const outcomeInfo = analysis?.outcome ? OUTCOME_LABELS[analysis.outcome.outcome] || OUTCOME_LABELS.unknown : null

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[
        { label: tn('home'), href: `/${locale}` },
        { label: t('decisions.search', 'Case Law'), href: `/${locale}/sudska-praksa/pretraga` },
        { label: decision.caseNumber || decision.title?.substring(0, 40) || `#${id}` },
      ]} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — 2/3 */}
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)]">
            {decision.title}
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
          </div>

          {/* Original language note */}
          {locale !== 'hr' && !translated && bodyText && (
            <p className="mt-2 text-xs text-[color:var(--color-text-muted)] italic">
              {t('decisions.originalLanguageNote', 'This decision is in its original Croatian. The Croatian text is the legally authoritative version.')}
            </p>
          )}

          {/* Decision body */}
          {bodyText ? (
            <div className="mt-6">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text)]" lang={translated ? locale : 'hr'}>
                {translated || bodyText}
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

          {/* AI Summary */}
          <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)] mb-2">
              {t('decisions.aiSummary', 'AI Summary')}
            </h3>
            {analysis?.summary ? (
              <p className="text-sm">{analysis.summary}</p>
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)] italic">
                {t('decisions.aiSummaryPending', 'AI summary will be generated when processing is complete.')}
              </p>
            )}
          </div>

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
