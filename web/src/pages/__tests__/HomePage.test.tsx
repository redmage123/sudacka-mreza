import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import HomePage from '../HomePage'

vi.mock('@/api/news', () => ({
  getNewsPosts: vi.fn(),
}))
vi.mock('@/api/court-decisions', () => ({
  searchDecisions: vi.fn(),
  getCourts_forFilter: vi.fn(),
}))
vi.mock('@/api/expert-witnesses', () => ({
  getExpertWitnesses: vi.fn(),
}))
vi.mock('@/api/interpreters', () => ({
  getInterpreters: vi.fn(),
}))
vi.mock('@/api/courts', () => ({
  getCourts: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`
      return key
    },
  }),
}))

import { getNewsPosts } from '@/api/news'
import { searchDecisions } from '@/api/court-decisions'
import { getExpertWitnesses } from '@/api/expert-witnesses'
import { getInterpreters } from '@/api/interpreters'
import { getCourts } from '@/api/courts'

const mockNewsFn = getNewsPosts as ReturnType<typeof vi.fn>
const mockDecisionsFn = searchDecisions as ReturnType<typeof vi.fn>
const mockExpertsFn = getExpertWitnesses as ReturnType<typeof vi.fn>
const mockInterpFn = getInterpreters as ReturnType<typeof vi.fn>
const mockCourtsFn = getCourts as ReturnType<typeof vi.fn>

const mockList = (docs: unknown[], totalDocs = docs.length) => ({
  docs,
  totalDocs,
  limit: 20,
  totalPages: 1,
  page: 1,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
})

const newsDocs = [
  { id: '1', title: 'Vijest 1', slug: 'vijest-1', published_at: '2024-01-01' },
  { id: '2', title: 'Vijest 2', slug: 'vijest-2', published_at: '2024-01-02' },
  { id: '3', title: 'Vijest 3', slug: 'vijest-3', published_at: '2024-01-03' },
  { id: '4', title: 'Vijest 4', slug: 'vijest-4', published_at: '2024-01-04' },
  { id: '5', title: 'Vijest 5', slug: 'vijest-5', published_at: '2024-01-05' },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hr']}>
      <Routes>
        <Route path="/:lang" element={<HomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNewsFn.mockResolvedValue(mockList(newsDocs))
  mockDecisionsFn.mockResolvedValue(mockList([], 1234))
  mockExpertsFn.mockResolvedValue(mockList([], 56))
  mockInterpFn.mockResolvedValue(mockList([], 89))
  mockCourtsFn.mockResolvedValue(mockList([], 420))
})

describe('HomePage', () => {
  it('AC-HOME-01: renders h1 with translated headline', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('AC-HOME-02: CTA button/link points to /${lang}/sudska-praksa/pretraga', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /home\.hero\.cta/i })
    expect(link).toHaveAttribute('href', '/hr/sudska-praksa/pretraga')
  })

  it('AC-HOME-03: Quick-access grid renders 6 cards', () => {
    renderPage()
    // 6 section cards (h2 headings)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.length).toBeGreaterThanOrEqual(6)
  })

  it('AC-HOME-04: grid has correct CSS classes', () => {
    const { container } = renderPage()
    const grid = container.querySelector('.grid.grid-cols-1')
    expect(grid).toBeInTheDocument()
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-3')
  })

  it('AC-HOME-05: shows Skeleton while news is loading', () => {
    mockNewsFn.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('AC-HOME-06: news strip renders 5 items after load', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Vijest 1')).toBeInTheDocument()
      expect(screen.getByText('Vijest 5')).toBeInTheDocument()
    })
    const newsLinks = screen.getAllByRole('link').filter(
      (l) => l.getAttribute('href')?.includes('/vijesti/'),
    )
    // 5 title links + 5 read-more links
    expect(newsLinks.length).toBeGreaterThanOrEqual(5)
  })

  it('AC-HOME-08: "view all news" link points to /${lang}/vijesti', async () => {
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /home\.news\.viewAll/i })
      expect(link).toHaveAttribute('href', '/hr/vijesti')
    })
  })

  it('AC-HOME-09: stats bar shows figures once loaded', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('1.234').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('AC-HOME-11: no hardcoded hex values in rendered HTML', () => {
    const { container } = renderPage()
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
