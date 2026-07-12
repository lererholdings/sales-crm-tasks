import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NewAccountModal from '../NewAccountModal.jsx'

describe('NewAccountModal', () => {
  it('shows inline validation errors for missing required fields on submit, without calling onCreate', () => {
    const onCreate = vi.fn()
    render(<NewAccountModal onClose={vi.fn()} onCreate={onCreate} />)

    fireEvent.click(screen.getByText('Create'))

    expect(screen.getByText('Name is required.')).toBeTruthy()
    expect(screen.getByText('Country is required.')).toBeTruthy()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('clears validation errors and submits once required fields are filled in', async () => {
    const onCreate = vi.fn().mockResolvedValue({})
    const onClose = vi.fn()
    render(<NewAccountModal onClose={onClose} onCreate={onCreate} />)

    fireEvent.click(screen.getByText('Create'))
    expect(screen.getByText('Name is required.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByLabelText('Country', { exact: false }), { target: { value: 'Australia' } })
    fireEvent.click(screen.getByText('Create'))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', country: 'Australia' }),
    )
  })
})
