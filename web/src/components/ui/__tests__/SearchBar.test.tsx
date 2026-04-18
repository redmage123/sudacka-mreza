import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar, type SearchSuggestion } from '../SearchBar'

const suggestions: SearchSuggestion[] = [
  { id: '1', label: 'Option A' },
  { id: '2', label: 'Option B' },
  { id: '3', label: 'Option C' },
]

describe('SearchBar', () => {
  it('submit button is present in DOM', () => {
    render(<SearchBar />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has form with role="search"', () => {
    render(<SearchBar />)
    expect(screen.getByRole('search')).toBeInTheDocument()
  })

  it('onSearch called with input value on form submit', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test query' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(onSearch).toHaveBeenCalledWith('test query')
  })

  it('suggestions prop: listbox appears when input has value', () => {
    render(<SearchBar suggestions={suggestions} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'opt' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('arrow down highlights first suggestion', () => {
    render(<SearchBar suggestions={suggestions} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'opt' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('enter on highlighted suggestion fires onSelectSuggestion', () => {
    const onSelect = vi.fn()
    render(<SearchBar suggestions={suggestions} onSelectSuggestion={onSelect} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'opt' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(suggestions[0])
  })

  it('Escape closes listbox', () => {
    render(<SearchBar suggestions={suggestions} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'opt' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('hero size renders text label on submit button', () => {
    render(<SearchBar size="hero" />)
    expect(screen.getByRole('button', { name: 'Traži' })).toBeInTheDocument()
  })

  it('loading prop disables submit button', () => {
    render(<SearchBar loading />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
