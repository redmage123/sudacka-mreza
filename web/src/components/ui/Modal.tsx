import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  /** Prevent closing when clicking the backdrop */
  static?: boolean
  footer?: ReactNode
  children: ReactNode
  /** For labelling via aria-labelledby when title is rendered externally */
  'aria-labelledby'?: string
}

const sizeMap: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-screen-lg',
}

/** Trap focus within container */
function trapFocus(container: HTMLElement, e: globalThis.KeyboardEvent) {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  static: isStatic = false,
  footer,
  children,
  'aria-labelledby': ariaLabelledBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  // useId() ensures unique IDs when multiple modals are mounted simultaneously
  const generatedId = useId()
  const titleId = ariaLabelledBy ?? generatedId
  const descId = `${generatedId}-desc`

  // Lock scroll and manage focus
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    // Focus first focusable element
    const raf = requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
      )
      el?.focus()
    })

    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = ''
      previousFocus.current?.focus()
    }
  }, [open])

  // Key handlers
  useEffect(() => {
    if (!open) return
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && dialogRef.current) trapFocus(dialogRef.current, e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={isStatic ? undefined : onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : ariaLabelledBy}
        aria-describedby={description ? descId : undefined}
        className={[
          'relative w-full bg-[color:var(--color-surface)] rounded-xl shadow-2xl flex flex-col max-h-[90vh]',
          sizeMap[size],
        ].join(' ')}
      >
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[color:var(--color-border)] shrink-0">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-[color:var(--color-text)]">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zatvori"
              className="shrink-0 rounded-lg p-1 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-subtle)] hover:text-[color:var(--color-text)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-[color:var(--color-border)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
