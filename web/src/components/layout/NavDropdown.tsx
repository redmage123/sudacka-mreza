import { useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { SupportedLanguage } from '../../i18n/index'

export interface NavDropdownItem {
  labelKey: string   // i18n key in 'nav' namespace
  to: string         // path relative to /:lang/
}

interface NavDropdownProps {
  labelKey: string
  items: NavDropdownItem[]
}

/**
 * Desktop nav dropdown — opens on hover or Enter/Space, closes on Escape or blur.
 * Fully keyboard-navigable with arrow keys.
 */
export function NavDropdown({ labelKey, items }: NavDropdownProps) {
  const { t } = useTranslation('nav')
  const { lang } = useParams<{ lang: SupportedLanguage }>()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const close = useCallback(() => setOpen(false), [])

  function handleButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      // Focus first item on next tick
      setTimeout(() => itemRefs.current[0]?.focus(), 0)
    } else if (e.key === 'Escape') {
      close()
    }
  }

  function handleItemKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx === 0) {
        buttonRef.current?.focus()
        close()
      } else {
        itemRefs.current[idx - 1]?.focus()
      }
    } else if (e.key === 'Escape') {
      buttonRef.current?.focus()
      close()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  // Close when focus leaves the entire dropdown
  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      close()
    }
  }

  const menuId = `dropdown-${labelKey}`

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onKeyDown={handleButtonKeyDown}
        onClick={() => setOpen((o) => !o)}
        className="
          flex items-center gap-1 px-3 py-2 text-sm font-medium
          text-white/90 hover:text-white
          rounded transition-colors duration-150
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-gold)] focus-visible:outline-offset-2
        "
      >
        {t(labelKey)}
        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="
            absolute top-full left-0 mt-1 z-50
            min-w-[200px] rounded-md shadow-lg
            bg-[var(--color-surface)] border border-[var(--color-border)]
            py-1
          "
        >
          {items.map((item, idx) => (
            <Link
              key={item.to}
              ref={(el) => { itemRefs.current[idx] = el }}
              to={`/${lang}/${item.to}`}
              role="menuitem"
              onClick={close}
              onKeyDown={(e) => handleItemKeyDown(e, idx)}
              className="
                block px-4 py-2 text-sm
                text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]
                hover:text-[var(--color-brand-navy)]
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-gold)]
                focus-visible:outline-offset-[-2px]
                transition-colors duration-100
              "
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
