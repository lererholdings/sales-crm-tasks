import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: UsersPanel } = await import('../UsersPanel.jsx')

const ME = { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' }
const OTHER = { id: 'u2', display_name: 'Sara', email: 's@x.com', role: 'member' }

function jsonResponse(body) {
  return { ok: true, json: async () => body }
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

describe('UsersPanel', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('lists users with their role', async () => {
    mockFetchByUrl({ '/api/users?me=true': ME, '/api/users': [ME, OTHER] })

    render(<UsersPanel />)

    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
    const row = screen.getByText('Sara').closest('tr')
    expect(within(row).getByText('s@x.com')).toBeTruthy()
    expect(within(row).getByDisplayValue('member')).toBeTruthy()
  })

  it('disables the role select for the current user', async () => {
    mockFetchByUrl({ '/api/users?me=true': ME, '/api/users': [ME, OTHER] })

    render(<UsersPanel />)

    await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy())
    const selfRow = screen.getByText('Admin').closest('tr')
    expect(within(selfRow).getByDisplayValue('admin').disabled).toBe(true)

    const otherRow = screen.getByText('Sara').closest('tr')
    expect(within(otherRow).getByDisplayValue('member').disabled).toBe(false)
  })

  it('changes another user\'s role, updating it in place without refetching the list', async () => {
    mockFetchByUrl({
      '/api/users?me=true': ME,
      '/api/users': (url, opts) =>
        opts?.method === 'PATCH' ? { id: 'u2', display_name: 'Sara', email: 's@x.com', role: 'admin' } : [ME, OTHER],
    })

    render(<UsersPanel />)
    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
    const listCallsBefore = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/users' && (!opts || opts.method === undefined),
    ).length

    const otherRow = screen.getByText('Sara').closest('tr')
    fireEvent.change(within(otherRow).getByDisplayValue('member'), { target: { value: 'admin' } })

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(patchCall[0]).toBe('/api/users/u2')
      expect(JSON.parse(patchCall[1].body)).toEqual({ role: 'admin' })
    })

    await waitFor(() => expect(within(screen.getByText('Sara').closest('tr')).getByDisplayValue('admin')).toBeTruthy())

    const listCallsAfter = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/users' && (!opts || opts.method === undefined),
    ).length
    expect(listCallsAfter).toBe(listCallsBefore) // no refetch triggered
  })

  it('shows an error message when the role change fails, instead of failing silently', async () => {
    global.fetch = vi.fn((url, opts) => {
      if (url === '/api/users?me=true') return Promise.resolve(jsonResponse(ME))
      if (opts?.method === 'PATCH') return Promise.resolve({ ok: false, json: async () => ({ error: 'Server error' }) })
      if (url === '/api/users') return Promise.resolve(jsonResponse([ME, OTHER]))
      return Promise.resolve(jsonResponse([]))
    })

    render(<UsersPanel />)
    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())

    const otherRow = screen.getByText('Sara').closest('tr')
    fireEvent.change(within(otherRow).getByDisplayValue('member'), { target: { value: 'admin' } })

    expect(await screen.findByText('Server error')).toBeTruthy()
  })
})
