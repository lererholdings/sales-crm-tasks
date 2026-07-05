import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: TasksPage } = await import('../TasksPage.jsx')

const TASK = {
  id: 't1',
  task_name: 'RFP response',
  account: { id: 'a1', name: 'Acme Corp' },
  partner_name: 'PartnerX',
  task_type: { id: 'tt1', category: 'pre-sale', name: 'RFP' },
  status: 'in_progress',
  priority: 'high',
  eta: null,
  next_action: 'Send draft',
  assignee: { id: 'u1', display_name: 'Sara' },
  notes: [],
}

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

// TasksPage's children (NewTaskModal, TaskSidePanel) each pull in their own
// accounts/task-types/users/current-user data, so the mock has to route by
// URL rather than a fixed call sequence.
function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.startsWith(pattern)) return Promise.resolve(jsonResponse(body))
    }
    return Promise.resolve(jsonResponse([]))
  })
}

describe('TasksPage', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('loads and displays tasks grouped by account + partner', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    render(<TasksPage />)

    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    expect(screen.getByText('Acme Corp — PartnerX')).toBeTruthy()
  })

  it('opens the new task modal', async () => {
    mockFetchByUrl({ '/api/tasks': [] })

    render(<TasksPage />)
    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeTruthy())

    fireEvent.click(screen.getByText('New task'))

    expect(screen.getByText('New task', { selector: 'h2' })).toBeTruthy()
  })

  it('deletes a task after confirming', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    render(<TasksPage />)
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Delete task'))
    expect(screen.getByText('Delete this task?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      const deleteCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'DELETE')
      expect(deleteCall).toBeDefined()
      expect(deleteCall[0]).toBe('/api/tasks/t1')
    })
  })

  it('refreshes the task list when the side panel closes (notes/edits show without a full reload)', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': { ...TASK, notes: [], notes_total: 0 },
      '/api/tasks': [TASK],
      '/api/users?me=true': { id: 'u1', display_name: 'Sara', email: 's@x.com', role: 'member' },
    })

    render(<TasksPage />)
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())

    const initialTasksCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length

    fireEvent.click(screen.getByText('RFP response'))
    await waitFor(() => expect(screen.getByLabelText('Close task panel')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Close task panel'))

    await waitFor(() => {
      const afterCloseCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length
      expect(afterCloseCalls).toBeGreaterThan(initialTasksCalls)
    })
  })

  it('cancelling the delete confirmation leaves the task in place', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    render(<TasksPage />)
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Delete task'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Delete this task?')).toBeFalsy()
    expect(global.fetch.mock.calls.some(([, opts]) => opts?.method === 'DELETE')).toBe(false)
  })
})
