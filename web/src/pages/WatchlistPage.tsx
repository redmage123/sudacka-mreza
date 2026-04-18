import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

interface WatchlistItem {
  id: string
  type: 'court' | 'judge' | 'caseType'
  name: string
  addedAt: string
}

function loadWatchlist(): WatchlistItem[] {
  try {
    return JSON.parse(localStorage.getItem('sudacka-watchlist') || '[]')
  } catch { return [] }
}

function saveWatchlist(items: WatchlistItem[]) {
  localStorage.setItem('sudacka-watchlist', JSON.stringify(items))
}

export default function WatchlistPage() {
  const { t } = useTranslation('common')
  const { t: tn } = useTranslation('nav')
  const { lang } = useParams<{ lang: string }>()
  const locale = lang ?? 'hr'
  usePageTitle('watchlist')

  const [items, setItems] = useState<WatchlistItem[]>(loadWatchlist)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'court' | 'judge' | 'caseType'>('court')

  useEffect(() => { saveWatchlist(items) }, [items])

  const addItem = () => {
    if (!newName.trim()) return
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      type: newType,
      name: newName.trim(),
      addedAt: new Date().toISOString(),
    }])
    setNewName('')
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const typeLabels = {
    court: t('watchlist.typeCourt', 'Court'),
    judge: t('watchlist.typeJudge', 'Judge'),
    caseType: t('watchlist.typeCaseType', 'Case Type'),
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumb items={[{ label: tn('home'), href: `/${locale}` }, { label: t('watchlist.title', 'Watchlist') }]} />

      <h1 className="text-3xl font-bold text-[color:var(--color-heading)] dark:text-[color:var(--color-brand-gold)] mb-6 mt-6">
        {t('watchlist.title', 'Watchlist')}
      </h1>

      <p className="text-[color:var(--color-text-muted)] mb-6">
        {t('watchlist.description', 'Track courts, judges, and case types. You will be notified when new decisions are published.')}
      </p>

      {/* Add form */}
      <div className="bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <select
          value={newType}
          onChange={e => setNewType(e.target.value as 'court' | 'judge' | 'caseType')}
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2 text-sm"
          aria-label={t('watchlist.selectType', 'Select type')}
        >
          <option value="court">{typeLabels.court}</option>
          <option value="judge">{typeLabels.judge}</option>
          <option value="caseType">{typeLabels.caseType}</option>
        </select>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={t('watchlist.namePlaceholder', 'Enter name...')}
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] dark:bg-[color:var(--color-surface-dark)] px-3 py-2 text-sm"
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          className="rounded-md bg-[color:var(--color-brand-navy)] text-white px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          {t('watchlist.add', 'Add')}
        </button>
      </div>

      {/* Watchlist items */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-[color:var(--color-text-muted)]">
          <svg className="mx-auto h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" role="img" aria-label={t('watchlist.emptyIcon', 'Empty watchlist')}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <p className="text-lg font-medium">{t('watchlist.empty', 'Your watchlist is empty')}</p>
          <p className="text-sm mt-1">{t('watchlist.emptyHint', 'Add courts, judges, or case types to track.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-dark)] border border-[color:var(--color-border)] rounded-lg p-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-gold)] mr-2">
                  {typeLabels[item.type]}
                </span>
                <span className="font-medium text-[color:var(--color-heading)]">{item.name}</span>
                <span className="text-xs text-[color:var(--color-text-muted)] ml-3">
                  {new Date(item.addedAt).toLocaleDateString(locale)}
                </span>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="text-[color:var(--color-error)] hover:opacity-80 text-sm"
                aria-label={t('watchlist.remove', 'Remove')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
