import { useState, useMemo, type ReactNode, useId } from 'react'
import { Pagination } from './Pagination'
import { Input } from './Input'
import { SkeletonTable } from './Skeleton'

export type SortDirection = 'asc' | 'desc'

export interface Column<T> {
  key: keyof T | string
  header: string
  /** Custom render function — receives the row and returns a ReactNode */
  render?: (row: T) => ReactNode
  /** Allow sorting on this column — requires the key to be a primitive field on T */
  sortable?: boolean
  /** Column min-width class e.g. "min-w-[12rem]" */
  className?: string
  /** Hide on small screens */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  /** Row key extractor */
  rowKey: (row: T) => string | number
  /** Number of rows per page — 0 disables pagination */
  pageSize?: number
  /** Show a search/filter input above the table */
  filterable?: boolean
  /** Placeholder for the filter input */
  filterPlaceholder?: string
  /** Custom filter function — defaults to JSON.stringify substring match */
  filterFn?: (row: T, query: string) => boolean
  loading?: boolean
  emptyMessage?: string
  caption?: string
  className?: string
  /** Slot rendered in the toolbar alongside the filter input */
  toolbar?: ReactNode
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void
}

const SortIcon = ({ direction }: { direction?: SortDirection }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
    {direction === 'asc' ? (
      <polyline points="18 15 12 9 6 15" />
    ) : direction === 'desc' ? (
      <polyline points="6 9 12 15 18 9" />
    ) : (
      <>
        <polyline points="18 15 12 9 6 15" className="opacity-30" />
        <polyline points="6 9 12 15 18 9" className="opacity-30" />
      </>
    )}
  </svg>
)

function defaultFilterFn<T>(row: T, query: string): boolean {
  return JSON.stringify(row).toLowerCase().includes(query.toLowerCase())
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  pageSize = 20,
  filterable = false,
  filterPlaceholder = 'Filtriraj...',
  filterFn,
  loading = false,
  emptyMessage = 'Nema podataka.',
  caption,
  className = '',
  toolbar,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const captionId = useId()

  const filterFnResolved = filterFn ?? defaultFilterFn

  // 1. Filter
  const filtered = useMemo(() => {
    if (!query) return data
    return data.filter(row => filterFnResolved(row, query))
  }, [data, query, filterFnResolved])

  // 2. Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey]
      const bv = (b as Record<string, unknown>)[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), 'hr', { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // 3. Paginate
  const paginated = useMemo(() => {
    if (pageSize === 0) return sorted
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const totalPages = pageSize === 0 ? 1 : Math.ceil(sorted.length / pageSize)

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function handleFilter(val: string) {
    setQuery(val)
    setPage(1)
  }

  if (loading) return <SkeletonTable rows={Math.min(pageSize || 5, 8)} cols={columns.length} />

  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      {/* Toolbar */}
      {(filterable || toolbar) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {filterable && (
            <div className="w-full sm:max-w-xs">
              <Input
                type="search"
                placeholder={filterPlaceholder}
                value={query}
                onChange={e => handleFilter(e.target.value)}
                aria-label={filterPlaceholder}
                leftAddon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
              />
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2 ml-auto">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-lg border border-[color:var(--color-border)]">
        <table
          className="w-full text-sm border-collapse"
          aria-labelledby={caption ? captionId : undefined}
        >
          {caption && (
            <caption id={captionId} className="sr-only">{caption}</caption>
          )}
          <thead>
            <tr className="bg-[color:var(--color-surface-subtle)] border-b border-[color:var(--color-border)]">
              {columns.map(col => {
                const key = String(col.key)
                const isSorted = sortKey === key
                return (
                  <th
                    key={key}
                    scope="col"
                    className={[
                      'px-4 py-3 text-left font-semibold text-[color:var(--color-text)] whitespace-nowrap',
                      col.className ?? '',
                      col.hideOnMobile ? 'hidden sm:table-cell' : '',
                      col.sortable ? 'cursor-pointer select-none hover:bg-[color:var(--color-border)] transition-colors' : '',
                    ].join(' ')}
                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined}
                    onClick={col.sortable ? () => handleSort(key) : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    onKeyDown={col.sortable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(key) } } : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && <SortIcon direction={isSorted ? sortDir : undefined} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[color:var(--color-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map(row => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? e => { if (e.key === 'Enter') onRowClick(row) } : undefined}
                  className={[
                    'border-b border-[color:var(--color-border)] last:border-0 transition-colors bg-[color:var(--color-surface)]',
                    onRowClick ? 'cursor-pointer hover:bg-[color:var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)]' : 'hover:bg-[color:var(--color-surface-subtle)]',
                  ].join(' ')}
                >
                  {columns.map(col => {
                    const key = String(col.key)
                    const cell = col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[key] ?? '')
                    return (
                      <td
                        key={key}
                        className={[
                          'px-4 py-3 text-[color:var(--color-text)]',
                          col.hideOnMobile ? 'hidden sm:table-cell' : '',
                          col.className ?? '',
                        ].join(' ')}
                      >
                        {cell}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pagination */}
      {(totalPages > 1 || sorted.length > 0) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[color:var(--color-text-muted)]">
          <span>
            {sorted.length === data.length
              ? `${sorted.length} rezultata`
              : `${sorted.length} od ${data.length} rezultata`}
          </span>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      )}
    </div>
  )
}
