import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useAuditLog } = await import('../useAuditLog.js')

describe('useAuditLog', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], total: 0 }) })
  })

  it('exposes entries and total from the { entries, total } response shape', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [{ id: 'log1' }], total: 137 }),
    })

    const { result } = renderHook(() => useAuditLog())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([{ id: 'log1' }])
    expect(result.current.total).toBe(137)
  })

  it('fetches the plain endpoint when no filters are given', async () => {
    const { result } = renderHook(() => useAuditLog())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/audit-log', expect.anything())
  })

  it('passes filters and pagination through as query params', async () => {
    const filters = { entity_type: 'task', action: 'updated', limit: 50, offset: 50 }
    const { result } = renderHook(() => useAuditLog(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/audit-log?entity_type=task&action=updated&limit=50&offset=50',
      expect.anything(),
    )
  })

  it('omits undefined/empty-string filters', async () => {
    const filters = { user_id: undefined, from: '', offset: 0 }
    const { result } = renderHook(() => useAuditLog(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/audit-log?offset=0', expect.anything())
  })
})
