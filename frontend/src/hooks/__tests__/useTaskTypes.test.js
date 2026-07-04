import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useTaskTypes } = await import('../useTaskTypes.js')

describe('useTaskTypes', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn()
  })

  it('fetches task types on mount', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 't1', category: 'pre-sale', name: 'Demo', active: true }],
    })

    const { result } = renderHook(() => useTaskTypes())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/task-types', expect.anything())
    expect(result.current.taskTypes).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('surfaces a fetch error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })

    const { result } = renderHook(() => useTaskTypes())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
  })
})
