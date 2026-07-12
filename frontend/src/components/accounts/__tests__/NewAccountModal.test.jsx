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

  it('sends the sfdc_account_url field through to onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue({})
    render(<NewAccountModal onClose={vi.fn()} onCreate={onCreate} />)

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByLabelText('Country', { exact: false }), { target: { value: 'Australia' } })
    fireEvent.change(screen.getByLabelText('SFDC account URL', { exact: false }), {
      target: { value: 'javascript:alert(1)' },
    })
    fireEvent.click(screen.getByText('Create'))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sfdc_account_url: 'javascript:alert(1)' }),
    )
  })

  it('shows the backend validation error and stays open when onCreate rejects (e.g. a length/URL-scheme violation)', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('name must be 300 characters or fewer'))
    const onClose = vi.fn()
    render(<NewAccountModal onClose={onClose} onCreate={onCreate} />)

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'a'.repeat(301) } })
    fireEvent.change(screen.getByLabelText('Country', { exact: false }), { target: { value: 'Australia' } })
    fireEvent.click(screen.getByText('Create'))

    expect(await screen.findByText('name must be 300 characters or fewer')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
