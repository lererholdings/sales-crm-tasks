import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: TaskSidePanel } = await import('../TaskSidePanel.jsx')

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

const TASK_DETAIL = {
  id: 't1',
  task_name: 'RFP response',
  account: { id: 'a1', name: 'Acme Corp', country: 'Australia', acv: 120000, sfdc_account_url: null },
  partner_name: 'PartnerX',
  distributor_name: null,
  task_type: { id: 'tt1', category: 'pre-sale', name: 'RFP' },
  status: 'in_progress',
  priority: 'high',
  eta: '2026-06-30',
  next_action: 'Send draft',
  sfdc_task_url: null,
  assignee: { id: 'u1', display_name: 'Sara' },
  last_updated_by: { id: 'u2', display_name: 'John' },
  updated_at: '2026-06-15T10:00:00Z',
  deleted_at: null,
  notes: [
    {
      id: 'n1',
      content: 'First note',
      user: { id: 'u1', display_name: 'Sara' },
      created_at: '2026-06-01T10:00:00Z',
      edited_at: null,
    },
  ],
  notes_total: 1,
}

const CURRENT_USER = { id: 'u1', display_name: 'Sara', email: 's@x.com', role: 'member' }

// TaskSidePanel pulls in accounts/task-types/users/current-user alongside
// the task itself, so the mock routes by URL prefix rather than call order.
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

describe('TaskSidePanel', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('loads the task detail and its notes', async () => {
    mockFetchByUrl({ '/api/tasks/t1?notes_limit': TASK_DETAIL, '/api/users?me=true': CURRENT_USER })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={vi.fn()} />)

    // Waiting on the notes section specifically (not just the header, which
    // renders on `task` alone) — the account/detail form fields only appear
    // once the form-hydrating effect has also flushed.
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())
    expect(screen.getByText('RFP response')).toBeTruthy()
  })

  it('shows an Edit affordance on the current user\'s own latest note', async () => {
    mockFetchByUrl({ '/api/tasks/t1?notes_limit': TASK_DETAIL, '/api/users?me=true': CURRENT_USER })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())

    expect(screen.getByText('Edit')).toBeTruthy()
  })

  it('hides the Edit affordance when the current user did not author the note', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': TASK_DETAIL,
      '/api/users?me=true': { ...CURRENT_USER, id: 'someone-else' },
    })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())

    expect(screen.queryByText('Edit')).toBeFalsy()
  })

  it('posts a new note and shows it immediately', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': TASK_DETAIL,
      '/api/users?me=true': CURRENT_USER,
      '/api/tasks/t1/notes': (_url, opts) =>
        opts?.method === 'POST'
          ? {
              id: 'n2',
              content: 'New note',
              user: CURRENT_USER,
              created_at: '2026-06-16T10:00:00Z',
              edited_at: null,
            }
          : { notes: [], total: 0, limit: 25, offset: 0 },
    })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText('Add a note… (markdown supported)'), {
      target: { value: 'New note' },
    })
    fireEvent.click(screen.getByText('Post note'))

    await waitFor(() => expect(screen.getByText('New note')).toBeTruthy())
  })

  it('saves a status/priority change through the same Save flow as other fields', async () => {
    const onUpdated = vi.fn()
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': TASK_DETAIL,
      '/api/users?me=true': CURRENT_USER,
      '/api/tasks/t1': (_url, opts) => {
        if (opts?.method === 'PATCH') {
          const body = JSON.parse(opts.body)
          return { ...TASK_DETAIL, ...body }
        }
        return TASK_DETAIL
      },
    })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={onUpdated} />)
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())

    // Status select shows the task's current value ("In progress"), open it
    // and pick "Done" instead.
    fireEvent.click(screen.getByText('In progress', { selector: 'button span' }))
    fireEvent.click(screen.getByText('Done'))

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([url, opts]) => url === '/api/tasks/t1' && opts?.method === 'PATCH',
      )
      expect(patchCall).toBeDefined()
      const body = JSON.parse(patchCall[1].body)
      expect(body.status).toBe('done')
      expect(body.priority).toBe('high') // unchanged, but still sent
    })

    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }))
  })

  it('keeps the task\'s own type selectable even after it is deactivated, but excludes other inactive types', async () => {
    mockFetchByUrl({
      '/api/tasks/t1?notes_limit': TASK_DETAIL,
      '/api/users?me=true': CURRENT_USER,
      '/api/task-types': [
        { id: 'tt1', category: 'pre-sale', name: 'RFP', active: false }, // the task's own current type
        { id: 'tt2', category: 'pre-sale', name: 'Demo', active: true },
        { id: 'tt3', category: 'pre-sale', name: 'Retired', active: false },
      ],
    })

    render(<TaskSidePanel taskId="t1" onClose={vi.fn()} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('First note')).toBeTruthy())

    fireEvent.click(screen.getByText('pre-sale · RFP'))

    expect(screen.getByText('pre-sale · Demo')).toBeTruthy()
    expect(screen.queryByText('pre-sale · Retired')).toBeFalsy()
  })
})
