import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Helmet } from 'react-helmet-async'
import { Breadcrumb } from '@/components/ui'
import { eurlexSearch, type EurLexHit } from '@/api/eurlex'

type Scope = 'any' | 'caselaw' | 'legislation'

export default function EurLexSearchPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'

  const [q, setQ] = useState('')
  const [scope, setScope] = useState<Scope>('any')
  const [restrictLang, setRestrictLang] = useState(false)
  const [hits, setHits] = useState<EurLexHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      const text = q.trim()
      if (!text || loading) return
      setLoading(true)
      setError(null)
      try {
        const r = await eurlexSearch({
          q: text,
          lang: restrictLang ? locale : undefined,
          scope,
          limit: 20,
        })
        setHits(r.docs)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setHits([])
      } finally {
        setLoading(false)
      }
    },
    [q, scope, restrictLang, locale, loading],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <Helmet>
        <title>{t('eurlex.title', 'EUR-Lex semantic search')} | Sudačka Mreža</title>
      </Helmet>
      <Breadcrumb
        items={[
          { label: tn('home'), href: `/${locale}` },
          { label: t('eurlex.title', 'EUR-Lex semantic search') },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold mb-1">
          {t('eurlex.title', 'EUR-Lex semantic search')}
        </h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          {t(
            'eurlex.subtitle',
            'Ask in your own words. Searches the full text of EU case law and legislation by meaning, not just keywords.',
          )}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-center gap-2 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-3"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(
            'eurlex.placeholder',
            'e.g. consumer protection in cross-border online sales',
          )}
          className="flex-1 min-w-[260px] px-3 py-2 border border-[color:var(--color-border)] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-gold)]"
          maxLength={500}
          aria-label={t('eurlex.placeholder', 'EUR-Lex search query')}
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          className="px-2 py-2 border border-[color:var(--color-border)] rounded text-sm bg-[color:var(--color-surface)]"
          aria-label={t('eurlex.scopeLabel', 'Scope')}
        >
          <option value="any">{t('eurlex.scopeAny', 'Case law + legislation')}</option>
          <option value="caselaw">{t('eurlex.scopeCaselaw', 'Case law only')}</option>
          <option value="legislation">{t('eurlex.scopeLegislation', 'Legislation only')}</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={restrictLang}
            onChange={(e) => setRestrictLang(e.target.checked)}
          />
          {t('eurlex.restrictLang', 'Only documents in')} {locale.toUpperCase()}
        </label>
        <button
          type="submit"
          disabled={loading || q.trim().length === 0}
          className="px-4 py-2 bg-[color:var(--color-brand-navy)] text-white rounded text-sm disabled:opacity-50"
        >
          {loading ? t('eurlex.searching', 'Searching…') : t('search', 'Search')}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {hits && hits.length === 0 && !loading && (
        <div className="text-[color:var(--color-text-muted)] italic">
          {t('eurlex.noResults', 'No matches yet. Try a broader phrasing.')}
        </div>
      )}

      {hits && hits.length > 0 && (
        <ol className="space-y-3">
          {hits.map((h, i) => (
            <li
              key={`${h.celex}-${h.lang}-${h.chunkIdx}-${i}`}
              className="border border-[color:var(--color-border)] rounded-lg p-3 bg-[color:var(--color-surface)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[color:var(--color-text-link)] hover:underline"
                >
                  {h.title || h.celex}
                </a>
                <span className="text-xs text-[color:var(--color-text-muted)] whitespace-nowrap">
                  {h.scope} · {h.lang.toUpperCase()}
                  {h.date ? ` · ${h.date.slice(0, 10)}` : ''}
                </span>
              </div>
              <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                CELEX {h.celex} · {t('eurlex.score', 'similarity')} {(h.score * 100).toFixed(0)}%
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap line-clamp-5">{h.snippet}…</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
