import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Breadcrumb, type BreadcrumbItem } from '../Breadcrumb'

const items: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Cases', href: '/cases' },
  { label: 'Case 123' },
]

describe('Breadcrumb', () => {
  const renderBreadcrumb = (i = items) =>
    render(
      <MemoryRouter>
        <Breadcrumb items={i} />
      </MemoryRouter>,
    )

  it('<nav aria-label="Breadcrumb"> present', () => {
    renderBreadcrumb()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
  })

  it('renders an <ol> inside nav', () => {
    const { container } = renderBreadcrumb()
    expect(container.querySelector('nav > ol')).toBeInTheDocument()
  })

  it('last item has aria-current="page" and is not a link', () => {
    renderBreadcrumb()
    const current = screen.getByText('Case 123')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(current.tagName.toLowerCase()).not.toBe('a')
  })

  it('non-last items with href render as links', () => {
    renderBreadcrumb()
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toBeInTheDocument()
    const casesLink = screen.getByRole('link', { name: 'Cases' })
    expect(casesLink).toBeInTheDocument()
  })

  it('separators are aria-hidden', () => {
    renderBreadcrumb()
    const hiddenElements = document.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenElements.length).toBeGreaterThan(0)
  })

  it('returns null for empty items', () => {
    const { container } = renderBreadcrumb([])
    expect(container.firstChild).toBeNull()
  })
})
