import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Spec-name icon prop — placed according to iconPosition */
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-border-focus)] disabled:pointer-events-none disabled:opacity-50 select-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--color-brand-navy)] text-[color:var(--color-text-inverse)] hover:bg-[color:var(--color-brand-navy-light)] active:bg-[color:var(--color-brand-navy-dark)]',
  secondary:
    'border border-[color:var(--color-brand-navy)] text-[color:var(--color-brand-navy)] bg-transparent hover:bg-[color:var(--color-surface-subtle)] active:bg-[color:var(--color-border)]',
  ghost:
    'text-[color:var(--color-text)] bg-transparent hover:bg-[color:var(--color-surface-subtle)] active:bg-[color:var(--color-border)]',
  danger:
    'bg-[color:var(--color-error)] text-white hover:bg-red-700 active:bg-red-800',
}

// sm uses min-h-[44px] to meet the 44×44px touch-target floor (DESIGN §9.4)
const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm h-8 min-h-[44px]',
  md: 'px-4 py-2 text-sm h-10 min-h-[44px]',
  lg: 'px-6 py-2.5 text-base h-12 min-h-[44px]',
}

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
    <path
      fill="currentColor"
      className="opacity-75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
)

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      leftIcon,
      rightIcon,
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    // Resolve icon/iconPosition (spec API) alongside leftIcon/rightIcon (alias API)
    const resolvedLeft = (icon && iconPosition === 'left' ? icon : undefined) ?? leftIcon
    const resolvedRight = (icon && iconPosition === 'right' ? icon : undefined) ?? rightIcon

    return (
      <button
        ref={ref}
        // loading: pointer-events-none without native disabled so tab order is preserved (AC-BTN-04)
        disabled={disabled}
        aria-busy={loading ? true : undefined}
        className={[
          base,
          variants[variant],
          sizes[size],
          loading ? 'pointer-events-none opacity-75' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? <Spinner /> : resolvedLeft}
        {children}
        {!loading && resolvedRight}
      </button>
    )
  },
)

Button.displayName = 'Button'
