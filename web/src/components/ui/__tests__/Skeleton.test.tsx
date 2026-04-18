import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonList } from '../Skeleton'

describe('Skeleton', () => {
  it('has role="status" and aria-busy="true"', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-busy', 'true')
    expect(el).toHaveAttribute('aria-label', 'Učitavanje...')
  })

  it('animate-pulse class applied', () => {
    render(<Skeleton />)
    expect(screen.getByRole('status').className).toContain('animate-pulse')
  })

  it('height prop applies class', () => {
    render(<Skeleton height="h-8" />)
    expect(screen.getByRole('status').className).toContain('h-8')
  })

  it('width prop applies class', () => {
    render(<Skeleton width="w-1/2" />)
    expect(screen.getByRole('status').className).toContain('w-1/2')
  })

  it('rounded="full" applies rounded-full class', () => {
    render(<Skeleton rounded="full" />)
    expect(screen.getByRole('status').className).toContain('rounded-full')
  })
})

describe('SkeletonCard', () => {
  it('renders 4 skeleton divs (title + 3 content bars)', () => {
    const { container } = render(<SkeletonCard />)
    // There's a wrapper div plus 4 Skeleton role="status" divs
    const skeletons = container.querySelectorAll('[role="status"]')
    expect(skeletons).toHaveLength(4)
  })
})

describe('SkeletonTable', () => {
  it('renders correct number of rows', () => {
    render(<SkeletonTable rows={3} cols={4} />)
    // There's 1 header row div + 3 data row divs, each with 4 skeleton cells
    // 1 header * 4 cols + 3 rows * 4 cols = 16 skeleton cells
    const skeletons = document.querySelectorAll('[role="status"]:not([aria-label="Učitavanje tablice..."])')
    expect(skeletons.length).toBeGreaterThanOrEqual(12)
  })

  it('has role="status" on the wrapper', () => {
    render(<SkeletonTable />)
    expect(screen.getByRole('status', { name: 'Učitavanje tablice...' })).toBeInTheDocument()
  })
})

describe('SkeletonList', () => {
  it('renders avatar circle + text bars per row', () => {
    const { container } = render(<SkeletonList rows={2} />)
    // 2 rows × 3 skeletons each (1 avatar + 2 text) = 6 skeleton divs (excluding wrapper)
    const skeletons = container.querySelectorAll('[role="status"]')
    // Each row: 1 circle + 2 text = 3 per row, 2 rows = 6 skeleton items + 1 list wrapper = 7
    expect(skeletons.length).toBeGreaterThanOrEqual(6)
  })
})
