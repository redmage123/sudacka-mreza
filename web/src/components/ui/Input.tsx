import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

// ─── shared styles ────────────────────────────────────────────────────────────

const fieldBase =
  'w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] text-sm transition-colors focus:outline-none focus-visible:border-[color:var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-border-focus)]/30 disabled:opacity-50 disabled:cursor-not-allowed'

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helpText?: string
  error?: string
  leftAddon?: ReactNode
  rightAddon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helpText, error, leftAddon, rightAddon, id, className = '', ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const errId = error && inputId ? `${inputId}-err` : undefined

    if (import.meta.env.DEV && !label && !props['aria-label'] && !props['aria-labelledby']) {
      console.warn('[Input] Missing `label` prop. All inputs must have an accessible label (DESIGN §6.2).')
    }

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[color:var(--color-text)]">
            {label}
            {props.required && <span className="text-[color:var(--color-error)] ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-3 text-[color:var(--color-text-muted)] pointer-events-none">{leftAddon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errId}
            className={[
              fieldBase,
              'px-3 py-2 h-10',
              leftAddon ? 'pl-9' : '',
              rightAddon ? 'pr-9' : '',
              error ? 'border-[color:var(--color-error)] focus-visible:border-[color:var(--color-error)] focus-visible:ring-[color:var(--color-error)]/30' : '',
              className,
            ].join(' ')}
            {...props}
          />
          {rightAddon && (
            <span className="absolute right-3 text-[color:var(--color-text-muted)] pointer-events-none">{rightAddon}</span>
          )}
        </div>
        {error && (
          <p id={errId} role="alert" className="text-xs text-[color:var(--color-error)]">{error}</p>
        )}
        {!error && helpText && (
          <p className="text-xs text-[color:var(--color-text-muted)]">{helpText}</p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helpText?: string
  error?: string
  placeholder?: string
  options?: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helpText, error, placeholder, options, id, className = '', children, ...props }, ref) => {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const errId = error && selectId ? `${selectId}-err` : undefined

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-[color:var(--color-text)]">
            {label}
            {props.required && <span className="text-[color:var(--color-error)] ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={errId}
            className={[
              fieldBase,
              'px-3 py-2 h-10 pr-9 appearance-none cursor-pointer',
              error ? 'border-[color:var(--color-error)]' : '',
              className,
            ].join(' ')}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            {children}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && <p id={errId} role="alert" className="text-xs text-[color:var(--color-error)]">{error}</p>}
        {!error && helpText && <p className="text-xs text-[color:var(--color-text-muted)]">{helpText}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helpText?: string
  error?: string
  minRows?: number
  maxRows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helpText, error, minRows, maxRows, id, className = '', style, ...props }, ref) => {
    const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const errId = error && textareaId ? `${textareaId}-err` : undefined

    const maxHeightStyle = maxRows
      ? { maxHeight: `calc(${maxRows} * 1.5em + 1rem)`, ...style }
      : style

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-[color:var(--color-text)]">
            {label}
            {props.required && <span className="text-[color:var(--color-error)] ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errId}
          rows={minRows ?? props.rows ?? 4}
          style={maxHeightStyle}
          className={[
            fieldBase,
            'px-3 py-2 resize-y min-h-[80px]',
            error ? 'border-[color:var(--color-error)] focus-visible:border-[color:var(--color-error)] focus-visible:ring-[color:var(--color-error)]/30' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p id={errId} role="alert" className="text-xs text-[color:var(--color-error)]">{error}</p>}
        {!error && helpText && <p className="text-xs text-[color:var(--color-text-muted)]">{helpText}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
