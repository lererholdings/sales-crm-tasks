import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: AdminPage } = await import('../AdminPage.jsx')

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        const body = typeof handler === 'function' ? handler(url) : handler
        return Promise.resolve(jsonResponse(body))
      }
    }
    return Promise.resolve(jsonResponse([]))
  })
}

function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/tasks" element={<div>Tasks page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminPage', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('redirects a member to /tasks instead of rendering the panel', async () => {
    mockFetchByUrl({ '/api/users?me=true': { id: 'u1', display_name: 'Member', email: 'm@x.com', role: 'member' } })

    renderAtAdmin()

    await waitFor(() => expect(screen.getByText('Tasks page')).toBeTruthy())
    expect(screen.queryByText('Task Types')).toBeFalsy()
  })

  it('renders the tab strip and defaults to the Task Types panel for an admin', async () => {
    mockFetchByUrl({
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
      '/api/task-types': [{ id: 't1', category: 'pre-sale', name: 'Demo', active: true }],
    })

    renderAtAdmin()

    await waitFor(() => expect(screen.getByText('Task Types')).toBeTruthy())
    expect(screen.getByText('Users')).toBeTruthy()
    expect(screen.getByText('Audit Log')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())
  })

  it('switches to the Users panel when its tab is clicked', async () => {
    mockFetchByUrl({
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
      '/api/users': [{ id: 'u2', display_name: 'Sara', email: 's@x.com', role: 'member' }],
    })

    renderAtAdmin()
    await waitFor(() => expect(screen.getByText('Task Types')).toBeTruthy())

    fireEvent.click(screen.getByText('Users'))

    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
  })

  it('switches to the Audit Log panel when its tab is clicked', async () => {
    mockFetchByUrl({
      '/api/users?me=true': { id: 'u1', display_name: 'Admin', email: 'a@x.com', role: 'admin' },
      '/api/audit-log': {
        entries: [
          {
            id: 'log1',
            entity_type: 'task',
            entity_id: 'task1',
            user: { id: 'u2', display_name: 'Sara' },
            action: 'updated',
            changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
            timestamp: '2026-06-15T10:00:00Z',
          },
        ],
        total: 1,
      },
    })

    renderAtAdmin()
    await waitFor(() => expect(screen.getByText('Task Types')).toBeTruthy())

    fireEvent.click(screen.getByText('Audit Log'))

    await waitFor(() => expect(screen.getByText('updated')).toBeTruthy())
  })
})
