import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'
import { Tag } from '../Tag'

describe('Badge', () => {
  const allVariants = [
    'default', 'gold', 'success', 'warning', 'error', 'info', 'neutral', 'closed', 'verified',
  ] as const

  it.each(allVariants)('renders %s variant without errors', (variant) => {
    render(<Badge variant={variant}>{variant}</Badge>)
    expect(screen.getByText(variant)).toBeInTheDocument()
  })

  it('default variant uses navy bg', () => {
    const { container } = render(<Badge variant="default">Default</Badge>)
    expect(container.firstChild).toHaveClass('bg-[color:var(--color-brand-navy)]')
  })

  it('gold variant uses navy text (not white)', () => {
    const { container } = render(<Badge variant="gold">Gold</Badge>)
    expect(container.firstChild).toHaveClass('text-[color:var(--color-brand-navy)]')
  })

  it('verified variant contains a checkmark icon', () => {
    const { container } = render(<Badge variant="verified">Verified</Badge>)
    const svg = container.querySelector('svg[aria-hidden="true"]')
    expect(svg).toBeInTheDocument()
  })

  it('closed variant renders without errors', () => {
    render(<Badge variant="closed">Zatvoreno</Badge>)
    expect(screen.getByText('Zatvoreno')).toBeInTheDocument()
  })

  it('size="md" applies larger padding class', () => {
    const { container } = render(<Badge size="md">Big</Badge>)
    expect(container.firstChild).toHaveClass('px-2.5')
    expect(container.firstChild).toHaveClass('py-1')
    expect(container.firstChild).toHaveClass('text-sm')
  })

  it('size="sm" (default) applies smaller padding', () => {
    const { container } = render(<Badge>Small</Badge>)
    expect(container.firstChild).toHaveClass('px-2')
    expect(container.firstChild).toHaveClass('py-0.5')
    expect(container.firstChild).toHaveClass('text-xs')
  })
})

describe('Tag', () => {
  it('Tag is functionally identical to Badge', () => {
    render(<Tag variant="success">Active</Tag>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('Tag importable separately', () => {
    expect(Tag).toBeDefined()
  })
})
