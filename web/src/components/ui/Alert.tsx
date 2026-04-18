import { type HTMLAttributes, type ReactNode } from 'react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  icon?: ReactNode
  onDismiss?: () => void
}

const styles: Record<AlertVariant, { wrapper: string; icon: string }> = {
  info: {
    wrapper: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100',
    icon: 'text-[color:var(--color-info)]',
  },
  success: {
    wrapper: 'bg-[color:var(--color-success-bg)] border-green-200 text-green-900 dark:border-green-800 dark:text-green-100',
    icon: 'text-[color:var(--color-success)]',
  },
  warning: {
    wrapper: 'bg-[color:var(--color-warning-bg)] border-yellow-200 text-yellow-900 dark:border-yellow-800 dark:text-yellow-100',
    icon: 'text-[color:var(--color-warning)]',
  },
  error: {
    wrapper: 'bg-[color:var(--color-error-bg)] border-red-200 text-red-900 dark:border-red-800 dark:text-red-100',
    icon: 'text-[color:var(--color-error)]',
  },
}

const defaultIcons: Record<AlertVariant, ReactNode> = {
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

export function Alert({
  variant = 'info',
  title,
  icon,
  onDismiss,
  className = '',
  children,
  ...props
}: AlertProps) {
  const s = styles[variant]
  const displayIcon = icon ?? defaultIcons[variant]

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-lg border text-sm',
        s.wrapper,
        className,
      ].join(' ')}
      {...props}
    >
      <span className={['mt-0.5 shrink-0', s.icon].join(' ')}>{displayIcon}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        {children && <div className="leading-snug">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Zatvori obavijest"
          className="shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}
