import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('nothing in DOM when open={false}', () => {
    render(<Modal open={false} onClose={() => {}} title="Test"><p>Body</p></Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('role="dialog" present when open={true}', () => {
    render(<Modal open={true} onClose={() => {}} title="Test"><p>Body</p></Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('aria-modal="true" on dialog', () => {
    render(<Modal open={true} onClose={() => {}} title="Test"><p>Body</p></Modal>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('Escape keypress fires onClose', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click fires onClose', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    // The backdrop is the aria-hidden div
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('static prop prevents backdrop click from firing onClose', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} static title="Test"><p>Body</p></Modal>)
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('each instance has a unique id on the title element', () => {
    render(
      <>
        <Modal open={true} onClose={() => {}} title="Modal One"><p>One</p></Modal>
        <Modal open={true} onClose={() => {}} title="Modal Two"><p>Two</p></Modal>
      </>
    )
    const h2s = screen.getAllByRole('heading')
    const ids = h2s.map(h => h.id)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBeTruthy()
  })

  it('aria-labelledby points to the title h2', () => {
    render(<Modal open={true} onClose={() => {}} title="My Modal"><p>Body</p></Modal>)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    const h2 = screen.getByRole('heading', { name: 'My Modal' })
    expect(labelledBy).toBe(h2.id)
  })

  it('footer slot renders in the bottom bar', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test" footer={<button>Cancel</button>}>
        <p>Body</p>
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
