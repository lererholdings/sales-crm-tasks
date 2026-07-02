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
})
