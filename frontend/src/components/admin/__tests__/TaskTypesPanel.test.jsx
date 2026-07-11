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

  it('creates a new task type via the inline form', async () => {
    mockFetchByUrl({ '/api/task-types': [TASK_TYPE] })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText('New task type name…'), { target: { value: 'Workshop' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      const createCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'POST')
      expect(createCall).toBeDefined()
      expect(createCall[0]).toBe('/api/task-types')
      expect(JSON.parse(createCall[1].body)).toEqual({ category: 'pre-sale', name: 'Workshop' })
    })
  })

  it('renames a task type inline', async () => {
    mockFetchByUrl({ '/api/task-types': [TASK_TYPE] })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())

    fireEvent.click(screen.getByText('Demo'))
    fireEvent.change(screen.getByDisplayValue('Demo'), { target: { value: 'Demo Call' } })
    fireEvent.blur(screen.getByDisplayValue('Demo Call'))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(patchCall[0]).toBe('/api/task-types?id=t1')
      expect(JSON.parse(patchCall[1].body)).toEqual({ name: 'Demo Call' })
    })
  })

  it('toggles active status via the checkbox', async () => {
    mockFetchByUrl({ '/api/task-types': [TASK_TYPE] })

    render(<TaskTypesPanel />)
    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy())

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(JSON.parse(patchCall[1].body)).toEqual({ active: false })
    })
  })
})
