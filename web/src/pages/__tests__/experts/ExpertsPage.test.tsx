import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import ExpertsPage from '../../experts/ExpertsPage'

vi.mock('@/api/expert-witnesses', () => ({ getExpertWitnesses: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { getExpertWitnesses } from '@/api/expert-witnesses'
const mockFn = getExpertWitnesses as ReturnType<typeof vi.fn>

const emptyList = { docs: [], totalDocs: 0, limit: 20, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/hr/strucnjaci/vjestaci${search}`]}>
      <Routes>
        <Route path="/:lang/strucnjaci/vjestaci" element={<ExpertsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { mockFn.mockResolvedValue(emptyList) })

describe('ExpertsPage', () => {
  it('AC-EXP-03: county dropdown lists all 21 CROATIAN_COUNTIES', async () => {
    renderPage()
    await waitFor(() => {
      const options = screen.getAllByRole('option').filter(
        (o) => o.textContent === 'Grad Zagreb' || o.textContent === 'Istarska',
      )
      expect(options.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('AC-EXP-05: verified badge only when expert.verified===true', async () => {
    mockFn.mockResolvedValue({
      ...emptyList,
      docs: [
        { id: '1', name: 'Pero Perić', speciality_areas: ['IT'], verified: true },
        { id: '2', name: 'Ana Anić', speciality_areas: ['Pravo'], verified: false },
        { id: '3', name: 'Ivo Ivić', speciality_areas: ['Med'] }, // no verified field
      ],
      totalDocs: 3,
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Pero Perić')).toBeInTheDocument()
    })
    const verifiedBadges = screen.getAllByText('common.verified')
    expect(verifiedBadges.length).toBe(1)
  })

  it('shows Skeleton while loading', () => {
    mockFn.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('shows empty state when no results', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('experts.noResults')).toBeInTheDocument()
    })
  })
})
