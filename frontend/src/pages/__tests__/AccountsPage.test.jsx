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

// AccountSidePanel is always mounted (even closed) and pulls in the current
// user (for the admin-only Archive button), so the mock has to route by URL
// rather than assume accounts is the only endpoint ever called.
function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.startsWith(pattern)) return Promise.resolve(jsonResponse(body))
    }
    return Promise.resolve(jsonResponse([]))
  })
}

function accountsCallCount() {
  return global.fetch.mock.calls.filter(([url]) => url.startsWith('/api/accounts') && !url.includes('search=')).length
}

describe('AccountsPage', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('loads and displays accounts from the API', async () => {
    mockFetchByUrl({
      '/api/accounts': [
        {
          id: 'a1',
          name: 'Acme Corp',
          country: 'Australia',
          sfdc_account_url: null,
          last_updated_by: null,
          updated_at: '2026-06-15T10:00:00Z',
          deleted_at: null,
        },
      ],
    })

    render(<AccountsPage />)

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledWith('/api/accounts', expect.anything())
  })

  it('re-fetches with a search query param when the search input changes', async () => {
    mockFetchByUrl({ '/api/accounts': [] })

    render(<AccountsPage />)
    await waitFor(() => expect(accountsCallCount()).toBeGreaterThan(0))

    fireEvent.change(screen.getByPlaceholderText('Search accounts…'), { target: { value: 'Acme' } })

    await waitFor(() => {
      const searchCall = global.fetch.mock.calls.find(([url]) => url === '/api/accounts?search=Acme')
      expect(searchCall).toBeDefined()
    })
  })

  it('opens the new account modal', async () => {
    mockFetchByUrl({ '/api/accounts': [] })

    render(<AccountsPage />)
    await waitFor(() => expect(accountsCallCount()).toBeGreaterThan(0))

    fireEvent.click(screen.getByText('New account'))

    expect(screen.getByText('Create')).toBeTruthy()
  })
})
