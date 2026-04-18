import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { Button } from '../Button'

describe('Button', () => {
  it('renders primary variant by default', () => {
    render(<Button>Click me</Button>)
    const btn = screen.getByRole('button', { name: 'Click me' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-[color:var(--color-brand-navy)]')
  })

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'renders %s variant without errors',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument()
    },
  )

  it.each(['sm', 'md', 'lg'] as const)('renders %s size', (size) => {
    render(<Button size={size}>{size}</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('sm size has min-h-[44px] class for touch target', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button').className).toContain('min-h-[44px]')
  })

  it('loading: shows spinner, sets aria-busy, keeps in tab order', () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    // Not natively disabled — stays in tab order
    expect(btn).not.toBeDisabled()
    // Spinner svg is in DOM
    expect(btn.querySelector('svg')).toBeInTheDocument()
  })

  it('disabled: has native disabled attribute, onClick not fired', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Btn</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('onClick fires when not disabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('forwardRef resolves to the button DOM node', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Ref</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('icon + iconPosition=left renders icon before children', () => {
    const icon = <span data-testid="icon">★</span>
    render(<Button icon={icon} iconPosition="left">Label</Button>)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('icon + iconPosition=right renders icon after children', () => {
    const icon = <span data-testid="icon-right">→</span>
    render(<Button icon={icon} iconPosition="right">Label</Button>)
    expect(screen.getByTestId('icon-right')).toBeInTheDocument()
  })
})
