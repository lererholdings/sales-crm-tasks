import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: TaskTypesPanel } = await import('../TaskTypesPanel.jsx')

const TASK_TYPE = { id: 't1', category: 'pre-sale', name: 'Demo', active: true }

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

// Method-aware: GET /api/task-types (list) and POST/PATCH (mutation
// response) must return different shapes — a list vs. a single row — so
// createTaskType/updateTaskType's in-place state updates actually get
// exercised with realistic data instead of an accidental pass.
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

describe('TaskTypesPanel', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('lists task types with their category', async () => {
    mockFetchByUrl({ '/api/task-types': [TASK_TYPE] })

    render(<TaskTypesPanel />)

    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())
    const row = screen.getByText('Demo').closest('tr')
    expect(within(row).getByText('pre-sale')).toBeTruthy()
  })

  it('creates a new task type via the inline form, appending it in place without refetching the list', async () => {
    mockFetchByUrl({
      '/api/task-types': (url, opts) =>
        opts?.method === 'POST' ? { id: 't2', category: 'pre-sale', name: 'Workshop', active: true } : [TASK_TYPE],
    })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())
    const listCallsBefore = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length

    fireEvent.change(screen.getByPlaceholderText('New task type name…'), { target: { value: 'Workshop' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => expect(screen.getByText('Workshop')).toBeTruthy())

    const createCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'POST')
    expect(createCall[0]).toBe('/api/task-types')
    expect(JSON.parse(createCall[1].body)).toEqual({ category: 'pre-sale', name: 'Workshop' })

    // Demo (the original row) is still there — appended, not replaced.
    expect(screen.getByText('Demo')).toBeTruthy()

    const listCallsAfter = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length
    expect(listCallsAfter).toBe(listCallsBefore) // no refetch triggered
  })

  it('shows an inline validation error when submitting the new task type form with an empty name', async () => {
    mockFetchByUrl({ '/api/task-types': [TASK_TYPE] })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())

    fireEvent.click(screen.getByText('Add'))

    expect(screen.getByText('Name is required.')).toBeTruthy()
    const createCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'POST')
    expect(createCall).toBeUndefined()
  })

  it('renames a task type inline, updating it in place without refetching the list', async () => {
    mockFetchByUrl({
      '/api/task-types': (url, opts) =>
        opts?.method === 'PATCH' ? { id: 't1', category: 'pre-sale', name: 'Demo Call', active: true } : [TASK_TYPE],
    })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())
    const listCallsBefore = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length

    fireEvent.click(screen.getByText('Demo'))
    fireEvent.change(screen.getByDisplayValue('Demo'), { target: { value: 'Demo Call' } })
    fireEvent.blur(screen.getByDisplayValue('Demo Call'))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(patchCall[0]).toBe('/api/task-types?id=t1')
      expect(JSON.parse(patchCall[1].body)).toEqual({ name: 'Demo Call' })
    })

    await waitFor(() => expect(screen.getByText('Demo Call')).toBeTruthy())
    expect(screen.queryByText('Demo')).toBeFalsy()

    const listCallsAfter = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length
    expect(listCallsAfter).toBe(listCallsBefore) // no refetch triggered
  })

  it('toggles active status via the checkbox, updating it in place without refetching the list', async () => {
    mockFetchByUrl({
      '/api/task-types': (url, opts) =>
        opts?.method === 'PATCH' ? { id: 't1', category: 'pre-sale', name: 'Demo', active: false } : [TASK_TYPE],
    })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())
    const listCallsBefore = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(JSON.parse(patchCall[1].body)).toEqual({ active: false })
    })

    await waitFor(() => expect(screen.getByRole('checkbox').checked).toBe(false))

    const listCallsAfter = global.fetch.mock.calls.filter(
      ([url, opts]) => url === '/api/task-types' && (!opts || opts.method === undefined),
    ).length
    expect(listCallsAfter).toBe(listCallsBefore) // no refetch triggered
  })
})
