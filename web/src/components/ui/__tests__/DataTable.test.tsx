import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type Column } from '../DataTable'

interface Person {
  id: number
  name: string
  role: string
}

const data: Person[] = [
  { id: 1, name: 'Ana Horvat', role: 'Admin' },
  { id: 2, name: 'Ivan Kovač', role: 'User' },
  { id: 3, name: 'Petra Jurić', role: 'Editor' },
]

const columns: Column<Person>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'role', header: 'Role' },
]

describe('DataTable', () => {
  const renderTable = (props = {}) =>
    render(
      <DataTable
        data={data}
        columns={columns}
        rowKey={r => r.id}
        caption="Test table"
        {...props}
      />,
    )

  it('renders table with sr-only caption', () => {
    renderTable()
    const caption = document.querySelector('caption')
    expect(caption).toBeInTheDocument()
    expect(caption?.className).toContain('sr-only')
  })

  it('thead and tbody present', () => {
    renderTable()
    expect(document.querySelector('thead')).toBeInTheDocument()
    expect(document.querySelector('tbody')).toBeInTheDocument()
  })

  it('scope="col" on all <th>', () => {
    renderTable()
    const ths = document.querySelectorAll('th')
    ths.forEach(th => expect(th).toHaveAttribute('scope', 'col'))
  })

  it('clicking sortable header changes aria-sort', () => {
    renderTable()
    const nameHeader = screen.getByRole('columnheader', { name: /name/i })
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
    fireEvent.click(nameHeader)
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(nameHeader)
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('filter input narrows displayed rows', () => {
    renderTable({ filterable: true })
    const filterInput = screen.getByRole('searchbox')
    fireEvent.change(filterInput, { target: { value: 'Ana' } })
    expect(screen.getByText('Ana Horvat')).toBeInTheDocument()
    expect(screen.queryByText('Ivan Kovač')).not.toBeInTheDocument()
  })

  it('loading prop renders skeleton instead of table', () => {
    renderTable({ loading: true })
    expect(document.querySelector('table')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Učitavanje tablice...'})).toBeInTheDocument()
  })

  it('empty state message appears when data is empty', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        rowKey={r => r.id}
        emptyMessage="No results found"
      />,
    )
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('onRowClick fires with correct row data', () => {
    const onRowClick = vi.fn()
    renderTable({ onRowClick })
    const rows = screen.getAllByRole('row')
    // First row is header; click the first data row
    fireEvent.click(rows[1])
    expect(onRowClick).toHaveBeenCalledWith(data[0])
  })

  it('row count text shown below table', () => {
    renderTable()
    expect(screen.getByText('3 rezultata')).toBeInTheDocument()
  })

  it('filtered count text shows N od M', () => {
    renderTable({ filterable: true })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ana' } })
    expect(screen.getByText('1 od 3 rezultata')).toBeInTheDocument()
  })
})
