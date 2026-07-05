import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: TaskToolbar } = await import('../TaskToolbar.jsx')

const DEFAULT_PREFERENCES = { column_order: [], column_visibility: {} }

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.startsWith(pattern)) return Promise.resolve(jsonResponse(body))
    }
    return Promise.resolve(jsonResponse([]))
  })
}

describe('TaskToolbar', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    mockFetchByUrl({
      '/api/users?me=true': { id: 'me1', display_name: 'Caller', role: 'member', email: 'caller@x.com' },
      '/api/users': [{ id: 'u1', display_name: 'Sara', role: 'member', email: 's@x.com' }],
      '/api/task-types': [{ id: 'tt1', category: 'pre-sale', name: 'RFP', active: true }],
    })
  })

  it('renders the search input and all five filter chips', async () => {
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    expect(screen.getByPlaceholderText('Search tasks, accounts, notes…')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Assignee')).toBeTruthy()
    expect(screen.getByText('Priority')).toBeTruthy()
    expect(screen.getByText('Type')).toBeTruthy()
    expect(screen.getByText('Partner')).toBeTruthy()
  })

  it('updates filters with an array when a status is checked from the Status chip', async () => {
    const onFilterChange = vi.fn()
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={onFilterChange}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Status'))
    fireEvent.click(screen.getByText('Backlog'))

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ status: ['backlog'] }))
  })

  it('accumulates multiple status checkboxes into one array', async () => {
    const onFilterChange = vi.fn()
    const { rerender } = render(
      <TaskToolbar
        filters={{}}
        onFilterChange={onFilterChange}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Status'))
    fireEvent.click(screen.getByText('Backlog'))
    rerender(
      <TaskToolbar
        filters={{ status: ['backlog'] }}
        onFilterChange={onFilterChange}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Waiting'))

    expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['backlog', 'waiting'] }))
  })

  it('populates the Assignee chip from useUsers', async () => {
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Assignee'))
    await waitFor(() => expect(screen.getByText('Sara')).toBeTruthy())
  })

  it('does not render the Show deleted toggle for a member', async () => {
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('Status')).toBeTruthy())
    expect(screen.queryByText('Show deleted')).toBeFalsy()
  })

  it('renders the Show deleted toggle for an admin and wires it to include_deleted', async () => {
    mockFetchByUrl({
      '/api/users?me=true': { id: 'me1', display_name: 'Admin', role: 'admin', email: 'admin@x.com' },
      '/api/users': [{ id: 'u1', display_name: 'Sara', role: 'member', email: 's@x.com' }],
      '/api/task-types': [{ id: 'tt1', category: 'pre-sale', name: 'RFP', active: true }],
    })
    const onFilterChange = vi.fn()
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={onFilterChange}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText('Show deleted')).toBeTruthy())
    fireEvent.click(screen.getByText('Show deleted'))

    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ include_deleted: true }))
  })

  it('calls onNewTask when the New task button is clicked', () => {
    const onNewTask = vi.fn()
    render(
      <TaskToolbar
        filters={{}}
        onFilterChange={vi.fn()}
        preferences={DEFAULT_PREFERENCES}
        onReorderColumns={vi.fn()}
        onToggleColumnVisibility={vi.fn()}
        onNewTask={onNewTask}
      />,
    )

    fireEvent.click(screen.getByText('New task'))
    expect(onNewTask).toHaveBeenCalled()
  })
})
