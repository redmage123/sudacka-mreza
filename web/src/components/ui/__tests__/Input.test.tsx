import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input, Select, Textarea } from '../Input'

describe('Input', () => {
  it('renders <label> with correct htmlFor', () => {
    render(<Input label="Email" id="email-field" />)
    const label = screen.getByText('Email')
    expect(label).toBeInTheDocument()
    expect(label.closest('label')).toHaveAttribute('for', 'email-field')
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'email-field')
  })

  it('derives id from label when id not provided', () => {
    render(<Input label="Full Name" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id', 'full-name')
    expect(screen.getByLabelText('Full Name')).toBe(input)
  })

  it('error prop: error text in DOM, aria-invalid, aria-describedby', () => {
    render(<Input label="Email" id="email" error="Invalid email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
    const errId = input.getAttribute('aria-describedby')
    expect(errId).toBeTruthy()
    expect(document.getElementById(errId!)).toHaveTextContent('Invalid email')
  })

  it('required prop adds asterisk with aria-hidden="true"', () => {
    render(<Input label="Name" required />)
    const asterisk = document.querySelector('[aria-hidden="true"]')
    expect(asterisk).toBeInTheDocument()
    expect(asterisk?.textContent).toBe('*')
  })

  it('disabled input has disabled attribute', () => {
    render(<Input label="Name" disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('leftAddon renders', () => {
    render(<Input label="Search" leftAddon={<span data-testid="addon">$</span>} />)
    expect(screen.getByTestId('addon')).toBeInTheDocument()
  })

  it('rightAddon renders', () => {
    render(<Input label="URL" rightAddon={<span data-testid="raddon">.com</span>} />)
    expect(screen.getByTestId('raddon')).toBeInTheDocument()
  })
})

describe('Select', () => {
  it('renders native <select> with label', () => {
    render(
      <Select label="Country" id="country" options={[{ value: 'hr', label: 'Croatia' }]} />,
    )
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
  })

  it('<option> elements render from options array', () => {
    render(
      <Select
        label="Role"
        options={[
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
        ]}
      />,
    )
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'User' })).toBeInTheDocument()
  })

  it('error prop shows error text', () => {
    render(<Select label="Role" error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})

describe('Textarea', () => {
  it('renders <label> with correct htmlFor', () => {
    render(<Textarea label="Message" id="msg" />)
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
  })

  it('rows attribute matches minRows', () => {
    render(<Textarea label="Bio" minRows={6} />)
    const ta = screen.getByRole('textbox')
    expect(ta).toHaveAttribute('rows', '6')
  })

  it('default rows is 4', () => {
    render(<Textarea label="Notes" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4')
  })

  it('error prop shows error text and aria-invalid', () => {
    render(<Textarea label="Notes" error="Too short" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Too short')).toBeInTheDocument()
  })
})
