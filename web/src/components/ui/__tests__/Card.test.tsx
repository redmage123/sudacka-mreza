import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children inside the card', () => {
    render(<Card>Card body</Card>)
    expect(screen.getByText('Card body')).toBeInTheDocument()
  })

  it('default render has token-based bg, border, rounded-lg', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('bg-[color:var(--color-surface)]')
    expect(card.className).toContain('border-[color:var(--color-border)]')
    expect(card.className).toContain('rounded-lg')
  })

  it('hoverable adds hover shadow classes', () => {
    const { container } = render(<Card hoverable>Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('hover:shadow-md')
  })

  it('as="article" renders <article>', () => {
    const { container } = render(<Card as="article">Content</Card>)
    expect(container.querySelector('article')).toBeInTheDocument()
  })

  it('as="li" renders <li>', () => {
    const { container } = render(<Card as="li">Content</Card>)
    expect(container.querySelector('li')).toBeInTheDocument()
  })

  it('default as="div" renders <div>', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('header slot renders with border-bottom', () => {
    render(<Card header={<span>Header</span>}>Body</Card>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  it('footer slot renders below body', () => {
    render(<Card footer={<span>Footer</span>}>Body</Card>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('flush removes padding class from body wrapper', () => {
    const { container } = render(<Card flush>Body</Card>)
    // container > Card > bodyWrapper (three levels deep because container is Testing Library's wrapper)
    const bodyWrapper = container.querySelector('div > div > div') as HTMLElement
    expect(bodyWrapper?.className).toBe('')
  })

  it('padding="sm" applies p-4', () => {
    const { container } = render(<Card padding="sm">Body</Card>)
    const bodyWrapper = container.querySelector('div > div > div') as HTMLElement
    expect(bodyWrapper?.className).toContain('p-4')
  })

  it('padding="lg" applies p-6', () => {
    const { container } = render(<Card padding="lg">Body</Card>)
    const bodyWrapper = container.querySelector('div > div > div') as HTMLElement
    expect(bodyWrapper?.className).toContain('p-6')
  })

  it('badge slot renders as absolute overlay', () => {
    render(<Card badge={<span>NEW</span>}>Body</Card>)
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })
})
