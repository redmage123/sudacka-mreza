import { type HTMLAttributes, type ReactNode, type ElementType } from 'react'

export type CardPadding = 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'li'
  header?: ReactNode
  footer?: ReactNode
  badge?: ReactNode
  /** Removes padding from the body area — useful when nesting a DataTable */
  flush?: boolean
  /** Adds hover shadow and border highlight */
  hoverable?: boolean
  /** Controls body padding size */
  padding?: CardPadding
}

const paddingMap: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  as: As = 'div',
  header,
  footer,
  badge,
  flush = false,
  hoverable = false,
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  const Tag = As as ElementType
  return (
    <Tag
      className={[
        'relative bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-sm overflow-hidden',
        hoverable
          ? 'transition-shadow hover:shadow-md hover:border-[color:var(--color-brand-navy-light)]'
          : '',
        className,
      ].join(' ')}
      {...props}
    >
      {badge && (
        <div className="absolute top-3 right-3 z-10">{badge}</div>
      )}

      {header && (
        <div className="px-5 py-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-subtle)]">
          {header}
        </div>
      )}

      <div className={flush ? '' : paddingMap[padding]}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-subtle)]">
          {footer}
        </div>
      )}
    </Tag>
  )
}
