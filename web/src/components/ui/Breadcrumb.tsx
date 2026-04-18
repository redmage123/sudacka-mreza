import { type ReactNode } from 'react'
import { Link } from 'react-router'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: ReactNode
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

const ChevronRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    className="text-[color:var(--color-text-muted)] shrink-0"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight />}
              {isLast ? (
                <span
                  aria-current="page"
                  className="text-[color:var(--color-text-muted)] flex items-center gap-1"
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  to={item.href}
                  className="text-[color:var(--color-text-link)] hover:text-[color:var(--color-text-link-hover)] transition-colors flex items-center gap-1"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <span className="text-[color:var(--color-text)] flex items-center gap-1">
                  {item.icon}
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
