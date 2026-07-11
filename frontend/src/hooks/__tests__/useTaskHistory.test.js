import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useTaskHistory } = await import('../useTaskHistory.js')

describe('useTaskHistory', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
  })

  it('fetches task-scoped entries on mount', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [{ id: 'log1' }], total: 1 }),
    })

    const { result } = renderHook(() => useTaskHistory('task1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/audit-log?task_id=task1&limit=20&offset=0', expect.anything())
    expect(result.current.entries).toEqual([{ id: 'log1' }])
    expect(result.current.total).toBe(1)
  })

  it('does not fetch when taskId is not yet set', () => {
    global.fetch = vi.fn()
    renderHook(() => useTaskHistory(null))

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('loadMore appends to the existing entries, offset by the current count', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [{ id: 'log1' }], total: 3 }),
    })

    const { result } = renderHook(() => useTaskHistory('task1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [{ id: 'log2' }, { id: 'log3' }], total: 3 }),
    })

    await result.current.loadMore()

    expect(global.fetch).toHaveBeenCalledWith('/api/audit-log?task_id=task1&limit=20&offset=1', expect.anything())
  })
})
