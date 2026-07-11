import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
  UserButton: () => null,
}))

const { default: Navbar } = await import('../Navbar.jsx')

function mockFetch(role) {
  global.fetch = vi.fn((url) => {
    if (url.startsWith('/api/users?me=true')) {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'u1', display_name: 'Sara', email: 's@x.com', role }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ theme: null }) })
  })
}

describe('Navbar', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })

  it('does not show the Admin link for a member', async () => {
    mockFetch('member')
    render(<Navbar />, { wrapper: MemoryRouter })

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/users?me=true', expect.anything()))
    expect(screen.queryByText('Admin')).toBeFalsy()
  })

  it('shows the Admin link for an admin', async () => {
    mockFetch('admin')
    render(<Navbar />, { wrapper: MemoryRouter })

    await waitFor(() => expect(screen.getByText('Admin')).toBeTruthy())
  })
})
