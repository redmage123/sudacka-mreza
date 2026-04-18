import { type HTMLAttributes } from 'react'

export type BadgeVariant =
  | 'default'
  | 'gold'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'closed'
  | 'verified'

export type BadgeSize = 'sm' | 'md'

const CheckCircleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const variants: Record<BadgeVariant, string> = {
  default:
    'bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)]',
  gold:
    'bg-[color:var(--color-brand-gold)] text-[color:var(--color-brand-navy)]',
  success:
    'bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]',
  warning:
    'bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]',
  error:
    'bg-[color:var(--color-error-bg)] text-[color:var(--color-error)]',
  // --color-info-bg token exists in globals.css; CSS var flips under .dark — no dark: prefix needed (ADR-0010)
  info:
    'bg-[color:var(--color-info-bg)] text-[color:var(--color-info)]',
  neutral:
    'bg-[color:var(--color-surface-subtle)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)]',
  // closed: represents expired/closed state (DESIGN §6.2)
  closed:
    'bg-[color:var(--color-surface-subtle)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)]',
  // verified: success background with checkmark icon (DESIGN §6.2)
  verified:
    'bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

export function Badge({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {variant === 'verified' && <CheckCircleIcon />}
      {children}
    </span>
  )
}
