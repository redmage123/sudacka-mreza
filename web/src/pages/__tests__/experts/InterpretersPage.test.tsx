import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import InterpretersPage from '../../experts/InterpretersPage'

vi.mock('@/api/interpreters', () => ({ getInterpreters: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { getInterpreters } from '@/api/interpreters'
const mockFn = getInterpreters as ReturnType<typeof vi.fn>

const emptyList = { docs: [], totalDocs: 0, limit: 20, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/hr/strucnjaci/tumaci${search}`]}>
      <Routes>
        <Route path="/:lang/strucnjaci/tumaci" element={<InterpretersPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { mockFn.mockResolvedValue(emptyList) })

describe('InterpretersPage', () => {
  it('AC-INTERP-02: verified badge only when verified===true', async () => {
    mockFn.mockResolvedValue({
      ...emptyList,
      docs: [
        { id: '1', name: 'Maja Majić', language_pairs: ['HR-EN'], verified: true },
        { id: '2', name: 'Luka Lukić', language_pairs: ['HR-DE'], verified: false },
      ],
      totalDocs: 2,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Maja Majić')).toBeInTheDocument()
    })
    const badges = screen.getAllByText('common.verified')
    expect(badges.length).toBe(1)
  })

  it('AC-INTERP-04: each result links to interpreter detail page', async () => {
    mockFn.mockResolvedValue({
      ...emptyList,
      docs: [{ id: 'abc123', name: 'Test Tumač', language_pairs: ['HR-EN'] }],
      totalDocs: 1,
    })
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Test Tumač' })
      expect(link).toHaveAttribute('href', '/hr/strucnjaci/tumaci/abc123')
    })
  })

  it('shows Skeleton while loading', () => {
    mockFn.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('AC-INTERP-01: language pair dropdown is rendered', async () => {
    mockFn.mockResolvedValue({
      ...emptyList,
      docs: [{ id: '1', name: 'A', language_pairs: ['HR-EN', 'HR-DE'] }],
      totalDocs: 1,
    })
    renderPage()
    await waitFor(() => {
      const select = document.querySelector('select') as HTMLSelectElement | null
      expect(select).toBeInTheDocument()
    })
  })
})
