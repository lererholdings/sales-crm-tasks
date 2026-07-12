import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: LinkToAccountModal } = await import('../LinkToAccountModal.jsx')

const TASK = { id: 't1', task_name: 'Security questionnaire' }

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

describe('LinkToAccountModal', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn((url) => {
      if (url.startsWith('/api/accounts')) {
        return Promise.resolve(
          jsonResponse([
            { id: 'a1', name: 'Acme Corp', deleted_at: null },
            { id: 'a2', name: 'BetaCo', deleted_at: null },
          ]),
        )
      }
      return Promise.resolve(jsonResponse([]))
    })
  })

  it('shows an inline validation error when linking with no account selected', async () => {
    const onLink = vi.fn()
    render(<LinkToAccountModal task={TASK} onClose={vi.fn()} onLink={onLink} />)

    await screen.findByText('Select account…')
    fireEvent.click(screen.getByText('Link'))

    expect(screen.getByText('An account is required.')).toBeTruthy()
    expect(onLink).not.toHaveBeenCalled()
  })

  it('links the selected account and closes on success', async () => {
    const onLink = vi.fn().mockResolvedValue()
    const onClose = vi.fn()
    render(<LinkToAccountModal task={TASK} onClose={onClose} onLink={onLink} />)

    fireEvent.click(await screen.findByText('Select account…'))
    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByText('Link'))

    await waitFor(() => expect(onLink).toHaveBeenCalledWith('a1'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows an error and stays open when linking fails', async () => {
    const onLink = vi.fn().mockRejectedValue(new Error('Task not found'))
    const onClose = vi.fn()
    render(<LinkToAccountModal task={TASK} onClose={onClose} onLink={onLink} />)

    fireEvent.click(await screen.findByText('Select account…'))
    fireEvent.click(screen.getByText('BetaCo'))
    fireEvent.click(screen.getByText('Link'))

    expect(await screen.findByText('Task not found')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
