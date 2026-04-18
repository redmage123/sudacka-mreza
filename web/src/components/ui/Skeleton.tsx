import { type HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Height in tailwind class notation or raw value — defaults to h-4 */
  height?: string
  /** Width — defaults to w-full */
  width?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full' | 'none'
}

const roundedMap = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function Skeleton({
  height = 'h-4',
  width = 'w-full',
  rounded = 'md',
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Učitavanje..."
      aria-busy="true"
      className={[
        'animate-pulse bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border)]',
        height,
        width,
        roundedMap[rounded],
        className,
      ].join(' ')}
      {...props}
    />
  )
}

// ─── Pre-built skeleton layouts ───────────────────────────────────────────────

/** One card-shaped skeleton block */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={['p-5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] space-y-3', className].join(' ')}>
      <Skeleton height="h-5" width="w-1/3" />
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-5/6" />
      <Skeleton height="h-3" width="w-4/6" />
    </div>
  )
}

/** A table skeleton — n rows × m cols */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Učitavanje tablice..." aria-busy="true" className="w-full overflow-hidden rounded-lg border border-[color:var(--color-border)]">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-[color:var(--color-surface-subtle)] border-b border-[color:var(--color-border)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="h-4" width={i === 0 ? 'w-1/4' : 'w-1/6'} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-[color:var(--color-border)] last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="h-4" width={c === 0 ? 'w-2/5' : 'w-1/5'} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Avatar + text rows */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Učitavanje..." aria-busy="true" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton height="h-10" width="w-10" rounded="full" className="shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton height="h-4" width="w-2/5" />
            <Skeleton height="h-3" width="w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
