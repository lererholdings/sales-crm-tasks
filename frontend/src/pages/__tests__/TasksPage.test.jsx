import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
// accounts/task-types/users/current-user/audit-log data, so the mock has to
// route by URL rather than a fixed call sequence. A route value can be a
// function (url, opts) => body to distinguish GET vs POST/PATCH on the same
// path. audit-log's default fallback needs the { entries, total } shape,
// not the plain-array shape every other endpoint here uses.
function mockFetchByUrl(routes) {
  global.fetch = vi.fn((url, opts) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        const body = typeof handler === 'function' ? handler(url, opts) : handler
        return Promise.resolve(jsonResponse(body))
      }
    }
    if (url.startsWith('/api/audit-log')) return Promise.resolve(jsonResponse({ entries: [], total: 0 }))
    return Promise.resolve(jsonResponse([]))
  })
}

function renderTasksPage(initialEntries = ['/tasks']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TasksPage />
    </MemoryRouter>,
  )
}

describe('TasksPage', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('loads and displays tasks grouped by account + partner', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    renderTasksPage()

    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    expect(screen.getByText('Acme Corp — PartnerX')).toBeTruthy()
  })

  it('opens the new task modal', async () => {
    mockFetchByUrl({ '/api/tasks': [] })

    renderTasksPage()
    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeTruthy())

    fireEvent.click(screen.getByText('New task'))

    expect(screen.getByText('New task', { selector: 'h2' })).toBeTruthy()
  })

  it('deletes a task after confirming', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    renderTasksPage()
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

  it('does not refetch the task list when the side panel closes without any change', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': { ...TASK, notes: [], notes_total: 0 },
      '/api/tasks': [TASK],
      '/api/users?me=true': { id: 'u1', display_name: 'Sara', email: 's@x.com', role: 'member' },
    })

    renderTasksPage()
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    const initialTasksCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length

    fireEvent.click(screen.getByText('RFP response'))
    await waitFor(() => expect(screen.getByLabelText('Close task panel')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Close task panel'))
    await waitFor(() => expect(screen.queryByLabelText('Close task panel')).toBeFalsy())

    const afterCloseCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length
    expect(afterCloseCalls).toBe(initialTasksCalls)
  })

  it('updates the row\'s NotesPreview after posting a note, without refetching the list', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': { ...TASK, notes: [], notes_total: 0 },
      '/api/tasks/t1/notes': (_url, opts) =>
        opts?.method === 'POST'
          ? {
              id: 'n1',
              content: 'New note',
              user: { id: 'u1', display_name: 'Sara' },
              created_at: '2026-07-05T00:00:00Z',
              edited_at: null,
            }
          : { notes: [], total: 0, limit: 25, offset: 0 },
      '/api/tasks': [TASK],
      '/api/users?me=true': { id: 'u1', display_name: 'Sara', email: 's@x.com', role: 'member' },
    })

    renderTasksPage()
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    const initialTasksCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length

    fireEvent.click(screen.getByText('RFP response'))
    await waitFor(() => expect(screen.getByPlaceholderText('Add a note… (markdown supported)')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText('Add a note… (markdown supported)'), {
      target: { value: 'New note' },
    })
    fireEvent.click(screen.getByText('Post note'))

    await waitFor(() => expect(screen.getAllByText(/New note/).length).toBeGreaterThan(0))

    const afterAddCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length
    expect(afterAddCalls).toBe(initialTasksCalls)

    fireEvent.click(screen.getByLabelText('Close task panel'))

    await waitFor(() => expect(screen.queryByLabelText('Close task panel')).toBeFalsy())
    expect(screen.getByText(/New note/)).toBeTruthy()
  })

  it('opens a task straight from a ?taskId= deep link, and clears the param on close', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': { ...TASK, notes: [], notes_total: 0 },
      '/api/tasks': [TASK],
      '/api/users?me=true': { id: 'u1', display_name: 'Sara', email: 's@x.com', role: 'member' },
    })

    renderTasksPage(['/tasks?taskId=t1'])

    await waitFor(() => expect(screen.getByLabelText('Close task panel')).toBeTruthy())
    expect(screen.getByText('RFP response', { selector: 'h2' })).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Close task panel'))
    await waitFor(() => expect(screen.queryByLabelText('Close task panel')).toBeFalsy())
  })

  it('links a partner-only task to an account, updating it in place without refetching the list', async () => {
    const PARTNER_ONLY_TASK = { ...TASK, id: 't2', account: null, partner_name: 'PartnerZ' }
    mockFetchByUrl({
      '/api/tasks/t2': (_url, opts) =>
        opts?.method === 'PATCH' ? { ...PARTNER_ONLY_TASK, account: { id: 'a1', name: 'Acme Corp' } } : PARTNER_ONLY_TASK,
      '/api/tasks': [PARTNER_ONLY_TASK],
      '/api/accounts': [{ id: 'a1', name: 'Acme Corp', deleted_at: null }],
    })

    renderTasksPage()
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())
    const initialTasksCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Link to account'))
    expect(screen.getByText('Link to account', { selector: 'h2' })).toBeTruthy()

    fireEvent.click(await screen.findByText('Select account…'))
    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([url, opts]) => url === '/api/tasks/t2' && opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(JSON.parse(patchCall[1].body)).toEqual({ account_id: 'a1' })
    })

    await waitFor(() => expect(screen.queryByText('Link to account', { selector: 'h2' })).toBeFalsy())
    expect(screen.getByText('Acme Corp — PartnerZ')).toBeTruthy() // group header now reflects the linked account

    const afterLinkCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/tasks').length
    expect(afterLinkCalls).toBe(initialTasksCalls) // no refetch triggered
  })

  it('cancelling the delete confirmation leaves the task in place', async () => {
    mockFetchByUrl({ '/api/tasks': [TASK] })

    renderTasksPage()
    await waitFor(() => expect(screen.getByText('RFP response')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Task actions'))
    fireEvent.click(screen.getByText('Delete task'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Delete this task?')).toBeFalsy()
    expect(global.fetch.mock.calls.some(([, opts]) => opts?.method === 'DELETE')).toBe(false)
  })
})
