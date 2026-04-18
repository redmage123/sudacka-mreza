import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('<nav aria-label="Straničenje"> present', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('navigation', { name: 'Straničenje' })).toBeInTheDocument()
  })

  it('current page button has aria-current="page"', () => {
    render(<Pagination page={3} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Stranica 3' })).toHaveAttribute('aria-current', 'page')
  })

  it('prev button disabled on page 1', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Prethodna stranica' })).toBeDisabled()
  })

  it('next button disabled on last page', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Sljedeća stranica' })).toBeDisabled()
  })

  it('click page 3: onPageChange called with 3', () => {
    const onPageChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stranica 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('returns null when totalPages <= 1', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('ellipsis elements have aria-hidden="true"', () => {
    render(<Pagination page={5} totalPages={10} onPageChange={() => {}} />)
    const ellipses = document.querySelectorAll('[aria-hidden="true"]')
    expect(ellipses.length).toBeGreaterThan(0)
  })
})
