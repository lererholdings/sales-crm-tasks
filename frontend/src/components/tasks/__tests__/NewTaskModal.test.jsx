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
})
