import { useRef, useState, useId, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'

export interface SearchSuggestion {
  id: string
  label: string
  description?: string
  icon?: ReactNode
}

export type SearchBarSize = 'default' | 'hero'

interface SearchBarProps {
  value?: string
  placeholder?: string
  suggestions?: SearchSuggestion[]
  loading?: boolean
  size?: SearchBarSize
  /** Called when the user commits a query (Enter / suggestion click / submit button) */
  onSearch?: (query: string) => void
  /** Called on every keystroke — use to fetch suggestions */
  onChange?: (value: string) => void
  /** Called when a suggestion is selected */
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void
  className?: string
  'aria-label'?: string
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export function SearchBar({
  value: controlledValue,
  placeholder = 'Pretraži...',
  suggestions = [],
  loading = false,
  size = 'default',
  onSearch,
  onChange,
  onSelectSuggestion,
  className = '',
  'aria-label': ariaLabel = 'Pretraži',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const value = controlledValue ?? internalValue
  const isHero = size === 'hero'

  function handleChange(val: string) {
    if (controlledValue === undefined) setInternalValue(val)
    onChange?.(val)
    setOpen(val.length > 0)
    setActiveIdx(-1)
  }

  function commit(query: string) {
    onSearch?.(query)
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    commit(value)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const s = suggestions[activeIdx]
      onSelectSuggestion?.(s)
      commit(s.label)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  const inputCls = [
    'w-full pl-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] transition-colors focus:outline-none focus:border-[color:var(--color-border-focus)] focus:ring-2 focus:ring-[color:var(--color-border-focus)]/30',
    isHero ? 'h-14 text-base pr-4' : 'h-11 text-sm pr-4',
  ].join(' ')

  const submitBtnCls = isHero
    ? 'shrink-0 h-14 px-6 text-base font-medium bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)] rounded-lg hover:bg-[color:var(--color-brand-navy-light)] transition-colors disabled:opacity-50 disabled:pointer-events-none'
    : 'shrink-0 h-11 w-11 flex items-center justify-center bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)] rounded-lg hover:bg-[color:var(--color-brand-navy-light)] transition-colors disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div className={['relative', className].join(' ')}>
      <form role="search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={`${listboxId}-input`}>{ariaLabel}</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)] pointer-events-none">
              {loading ? <SpinnerIcon /> : <SearchIcon />}
            </span>
            <input
              ref={inputRef}
              id={`${listboxId}-input`}
              type="search"
              value={value}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
              aria-autocomplete="list"
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => value && suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-label={isHero ? undefined : 'Pretraži'}
            className={submitBtnCls}
          >
            {isHero ? 'Traži' : <SearchIcon />}
          </button>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.id}
              id={`${listboxId}-opt-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={() => {
                onSelectSuggestion?.(s)
                commit(s.label)
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={[
                'flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors',
                idx === activeIdx
                  ? 'bg-[color:var(--color-surface-subtle)] text-[color:var(--color-heading)]'
                  : 'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-subtle)]',
              ].join(' ')}
            >
              {s.icon && <span className="shrink-0 text-[color:var(--color-text-muted)]">{s.icon}</span>}
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{s.label}</span>
                {s.description && (
                  <span className="block text-xs text-[color:var(--color-text-muted)] truncate">{s.description}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
