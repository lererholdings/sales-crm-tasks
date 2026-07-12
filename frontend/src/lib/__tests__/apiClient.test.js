import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useApiClient } = await import('../apiClient.js')

describe('useApiClient', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('test-token')
    global.fetch = vi.fn()
  })

  it('attaches the Clerk token as a Bearer header', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useApiClient())
    await result.current.get('/health')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('throws with the server error message on a non-OK response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) })

    const { result } = renderHook(() => useApiClient())

    await expect(result.current.get('/users')).rejects.toMatchObject({ status: 403, message: 'Forbidden' })
  })

  it('sends a JSON body on POST/PATCH', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() => useApiClient())
    await result.current.patch('/users/u1', { role: 'admin' })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/u1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }),
    )
  })

  it('retries once with a forced-fresh token on a 401, and succeeds if the retry is OK', async () => {
    getTokenMock.mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token')
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'Invalid or expired session' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useApiClient())
    const data = await result.current.get('/tasks')

    expect(data).toEqual({ ok: true })
    expect(getTokenMock).toHaveBeenNthCalledWith(2, { skipCache: true })
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/tasks',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) }),
    )
  })

  it('dispatches a session-expired event and throws if still 401 after the forced refresh', async () => {
    getTokenMock.mockResolvedValue('token')
    global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Invalid or expired session' }) })
    const listener = vi.fn()
    window.addEventListener('session-expired', listener)

    const { result } = renderHook(() => useApiClient())

    await expect(result.current.get('/tasks')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(2) // original + one forced-refresh retry, no more

    window.removeEventListener('session-expired', listener)
  })
})
