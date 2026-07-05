import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useTasks } = await import('../useTasks.js')

describe('useTasks', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('fetches the plain endpoint when no filters are given', async () => {
    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks', expect.anything())
  })

  it('joins an array filter (status, priority) into a comma-separated query param', async () => {
    // Hoisted to a stable reference — useTasks's refresh depends on the
    // filters object's identity (see its docstring), so a fresh literal
    // per render would refetch in a loop instead of once.
    const filters = { status: ['backlog', 'waiting'] }
    const { result } = renderHook(() => useTasks(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks?status=backlog%2Cwaiting', expect.anything())
  })

  it('omits an empty array filter entirely rather than sending an empty param', async () => {
    const filters = { status: [], assignee_id: 'u1' }
    const { result } = renderHook(() => useTasks(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks?assignee_id=u1', expect.anything())
  })

  it('omits undefined/null/empty-string scalar filters', async () => {
    const filters = { search: undefined, partner_name: null, task_type_id: '' }
    const { result } = renderHook(() => useTasks(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/tasks', expect.anything())
  })
})
