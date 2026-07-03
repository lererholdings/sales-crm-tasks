import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: AccountsPage } = await import('../AccountsPage.jsx')

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

describe('AccountsPage', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn()
  })

  it('loads and displays accounts from the API', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 'a1',
          name: 'Acme Corp',
          country: 'Australia',
          sfdc_account_url: null,
          last_updated_by: null,
          updated_at: '2026-06-15T10:00:00Z',
        },
      ]),
    )

    render(<AccountsPage />)

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledWith('/api/accounts', expect.anything())
  })

  it('re-fetches with a search query param when the search input changes', async () => {
    global.fetch.mockResolvedValue(jsonResponse([]))

    render(<AccountsPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByPlaceholderText('Search accounts…'), { target: { value: 'Acme' } })

    await waitFor(() => {
      const lastCall = global.fetch.mock.calls.at(-1)
      expect(lastCall[0]).toBe('/api/accounts?search=Acme')
    })
  })

  it('opens the new account modal', async () => {
    global.fetch.mockResolvedValue(jsonResponse([]))

    render(<AccountsPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('New account'))

    expect(screen.getByText('Create')).toBeTruthy()
  })
})
