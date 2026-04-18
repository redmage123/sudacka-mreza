interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** How many page numbers to show either side of the current page */
  siblings?: number
  className?: string
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function buildPages(current: number, total: number, siblings: number): (number | '…')[] {
  if (total <= 7) return range(1, total)

  const left = Math.max(2, current - siblings)
  const right = Math.min(total - 1, current + siblings)

  const showLeftDots = left > 2
  const showRightDots = right < total - 1

  if (!showLeftDots && showRightDots) {
    return [...range(1, 3 + siblings * 2), '…', total]
  }
  if (showLeftDots && !showRightDots) {
    return [1, '…', ...range(total - 2 - siblings * 2, total)]
  }
  return [1, '…', ...range(left, right), '…', total]
}

export function Pagination({ page, totalPages, onPageChange, siblings = 1, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = buildPages(page, totalPages, siblings)

  // min-h-[44px] ensures 44×44px touch target (DESIGN §9.4)
  const btnBase =
    'inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)]'

  const pageBtn = (active: boolean) =>
    active
      ? `${btnBase} bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)]`
      : `${btnBase} text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-subtle)]`

  const arrowBtn = `${btnBase} text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-subtle)] hover:text-[color:var(--color-text)]`

  return (
    <nav aria-label="Straničenje" className={['flex items-center gap-1', className].join(' ')}>
      {/* Previous */}
      <button
        type="button"
        aria-label="Prethodna stranica"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={arrowBtn}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`dots-${i}`} aria-hidden="true" className="px-1 text-[color:var(--color-text-muted)] select-none">…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Stranica ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p as number)}
            className={pageBtn(p === page)}
          >
            {p}
          </button>
        ),
      )}

      {/* Next */}
      <button
        type="button"
        aria-label="Sljedeća stranica"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={arrowBtn}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </nav>
  )
}
