import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { default: NewTaskModal } = await import('../NewTaskModal.jsx')

function jsonResponse(body) {
  return { ok: true, json: async () => body }
}

describe('NewTaskModal', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn(() => Promise.resolve(jsonResponse([])))
  })

  // Regression test: a brand-new task should never start as "Done" — that
  // status is only reachable later by editing an existing task.
  it('does not offer "Done" as a status option for a new task', () => {
    render(<NewTaskModal tasks={[]} onClose={vi.fn()} onCreate={vi.fn()} />)

    const statusButtons = screen.getAllByRole('button').filter((b) => b.textContent === 'Backlog')
    fireEvent.click(statusButtons[0])

    expect(screen.queryByText('Done')).toBeFalsy()
    expect(screen.getByText('Waiting')).toBeTruthy()
  })

  it('excludes deactivated task types from the type dropdown', async () => {
    global.fetch = vi.fn((url) => {
      if (url.startsWith('/api/task-types')) {
        return Promise.resolve(
          jsonResponse([
            { id: 't1', category: 'pre-sale', name: 'Demo', active: true },
            { id: 't2', category: 'pre-sale', name: 'Retired', active: false },
          ]),
        )
      }
      return Promise.resolve(jsonResponse([]))
    })

    render(<NewTaskModal tasks={[]} onClose={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByText('Select type…'))

    expect(screen.getByText('pre-sale · Demo')).toBeTruthy()
    expect(screen.queryByText('pre-sale · Retired')).toBeFalsy()
  })
})
