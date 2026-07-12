import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: AccountSidePanel } = await import('../AccountSidePanel.jsx')

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

const ACCOUNT = {
  id: 'a1',
  name: 'Acme Corp',
  country: 'Australia',
  acv: 50000,
  sfdc_account_url: null,
  last_updated_by: null,
  updated_at: '2026-06-15T10:00:00Z',
  deleted_at: null,
}

function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url, opts) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        const body = typeof handler === 'function' ? handler(url, opts) : handler
        return Promise.resolve(jsonResponse(body))
      }
    }
    return Promise.resolve(jsonResponse([]))
  })
}

describe('AccountSidePanel archive (issue #5)', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('does not render an unsafe (non-http) sfdc_account_url as a link', async () => {
    mockFetchByUrl({
      '/api/accounts/a1': { ...ACCOUNT, sfdc_account_url: 'javascript:alert(1)' },
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy())

    expect(screen.queryByText('SFDC account')).toBeFalsy()
  })

  it('shows the Archive button to an admin', async () => {
    mockFetchByUrl({
      '/api/accounts/a1': ACCOUNT,
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Archive')).toBeTruthy())
  })

  it('hides the Archive button from a non-admin', async () => {
    mockFetchByUrl({
      '/api/accounts/a1': ACCOUNT,
      '/api/users?me=true': { id: 'u1', display_name: 'Member', email: 'm@x.com', role: 'member' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeTruthy())
    expect(screen.queryByText('Archive')).toBeFalsy()
  })

  it('hides the Archive button when the account is already archived', async () => {
    mockFetchByUrl({
      '/api/accounts/a1': { ...ACCOUNT, deleted_at: '2026-07-01T00:00:00Z' },
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('(archived)').length).toBeGreaterThan(0))
    expect(screen.queryByText('Archive')).toBeFalsy()
  })

  it('archives the account after confirming, and shows the "(archived)" caption', async () => {
    const onUpdated = vi.fn()
    mockFetchByUrl({
      '/api/accounts/a1': (_url, opts) =>
        opts?.method === 'DELETE' ? { ...ACCOUNT, deleted_at: '2026-07-05T00:00:00Z' } : ACCOUNT,
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={onUpdated} />)
    await waitFor(() => expect(screen.getByText('Archive')).toBeTruthy())

    fireEvent.click(screen.getByText('Archive'))
    expect(screen.getByText('Archive this account?')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1))

    await waitFor(() => expect(screen.getAllByText('(archived)').length).toBeGreaterThan(0))
    expect(onUpdated).toHaveBeenCalled()

    const deleteCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'DELETE')
    expect(deleteCall[0]).toBe('/api/accounts/a1')
  })

  it('shows an inline validation error when saving with a blank name, without calling the API', async () => {
    mockFetchByUrl({
      '/api/accounts/a1': ACCOUNT,
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy())

    fireEvent.change(screen.getByDisplayValue('Acme Corp'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))

    expect(screen.getByText('Name is required.')).toBeTruthy()
    const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
    expect(patchCall).toBeUndefined()
  })

  it('shows an error when archiving fails (e.g. active tasks)', async () => {
    global.fetch = vi.fn((url, opts) => {
      if (url.startsWith('/api/accounts/a1') && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'Cannot archive an account with active tasks' }) })
      }
      if (url.startsWith('/api/accounts/a1')) return Promise.resolve(jsonResponse(ACCOUNT))
      if (url.startsWith('/api/users?me=true')) {
        return Promise.resolve(jsonResponse({ id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' }))
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(<AccountSidePanel accountId="a1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Archive')).toBeTruthy())

    fireEvent.click(screen.getByText('Archive'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' }).at(-1))

    await waitFor(() => expect(screen.getByText('Cannot archive an account with active tasks')).toBeTruthy())
  })
})
