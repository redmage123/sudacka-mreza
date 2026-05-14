import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Accessible label for the reveal button when the password is hidden. */
  showLabel?: string
  /** Accessible label for the reveal button when the password is visible. */
  hideLabel?: string
}

/**
 * A password `<input>` with a show/hide eye toggle. Drop-in replacement for a
 * plain `<input type="password">` — pass the same props (id, value, onChange,
 * autoComplete, className, disabled, aria-*). The `type` is managed internally.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className = '', showLabel = 'Show password', hideLabel = 'Hide password', ...rest },
    ref,
  ) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          type={visible ? 'text' : 'password'}
          // pr-11 leaves room for the toggle button so it never overlaps text.
          className={`${className} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          // tabIndex -1: keep Tab order on the form fields, not the toggle.
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] focus:outline-none focus:text-[color:var(--color-text)]"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  },
)
