import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import CourtsPage from '../../courts/CourtsPage'

vi.mock('@/api/courts', () => ({ getCourts: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { getCourts } from '@/api/courts'
const mockFn = getCourts as ReturnType<typeof vi.fn>

const emptyList = { docs: [], totalDocs: 0, limit: 20, totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null }

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/hr/sudovi${search}`]}>
      <Routes>
        <Route path="/:lang/sudovi" element={<CourtsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { mockFn.mockResolvedValue(emptyList) })

describe('CourtsPage', () => {
  it('AC-CRTS-01: default tab is "municipal" (opcinski) when no type param', async () => {
    renderPage()
    // Should call getCourts with type: 'municipal'
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ type: 'municipal' }))
    })
  })

  it('AC-CRTS-09: deep-link ?type=commercial pre-selects commercial tab', async () => {
    renderPage('?type=commercial')
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ type: 'commercial' }))
    })
    const tabBtns = screen.getAllByRole('tab')
    const commercialTab = tabBtns.find((b) => b.textContent === 'courts.tab.trgovacki')
    expect(commercialTab).toHaveAttribute('aria-selected', 'true')
  })

  it('AC-CRTS-04: tab container has role="tablist"', () => {
    renderPage()
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('AC-CRTS-03: each tab button has role="tab" and aria-selected', () => {
    renderPage()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(4)
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected')
    })
  })

  it('AC-CRTS-02: clicking tab updates type param and resets page', async () => {
    const user = userEvent.setup()
    renderPage()
    const tabs = screen.getAllByRole('tab')
    await user.click(tabs[1]) // county tab
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ type: 'county' }))
    })
  })

  it('AC-CRTS-07: shows Skeleton while loading', () => {
    mockFn.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('AC-CRTS-08: each court links to detail page', async () => {
    mockFn.mockResolvedValue({
      ...emptyList,
      docs: [{ id: 'court-1', name: 'Općinski sud Zagreb', type: 'municipal' }],
      totalDocs: 1,
    })
    renderPage()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Općinski sud Zagreb' })
      expect(link).toHaveAttribute('href', '/hr/sudovi/court-1')
    })
  })
})
