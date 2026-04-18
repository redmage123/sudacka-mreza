import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Alert } from '../Alert'

describe('Alert', () => {
  const variants = ['info', 'success', 'warning', 'error'] as const

  it.each(variants)('renders %s variant with role="alert"', (variant) => {
    render(<Alert variant={variant}>Message</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it.each(variants)('all variants render without errors', (variant) => {
    render(<Alert variant={variant}>{variant} message</Alert>)
    expect(screen.getByText(`${variant} message`)).toBeInTheDocument()
  })

  it('dismiss button present when onDismiss provided', () => {
    render(<Alert onDismiss={() => {}}>Content</Alert>)
    expect(screen.getByRole('button', { name: 'Zatvori obavijest' })).toBeInTheDocument()
  })

  it('dismiss button fires callback on click', () => {
    const onDismiss = vi.fn()
    render(<Alert onDismiss={onDismiss}>Content</Alert>)
    fireEvent.click(screen.getByRole('button', { name: 'Zatvori obavijest' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('no dismiss button when onDismiss absent', () => {
    render(<Alert>Content</Alert>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('title renders bold above message', () => {
    render(<Alert title="Pažnja">Message body</Alert>)
    expect(screen.getByText('Pažnja')).toBeInTheDocument()
    expect(screen.getByText('Message body')).toBeInTheDocument()
  })

  it('icon prop renders left of content', () => {
    const icon = <span data-testid="custom-icon">⚠</span>
    render(<Alert icon={icon}>Content</Alert>)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})
