import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_COLUMN_ORDER } from '../../lib/columns.js'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { usePreferences } = await import('../usePreferences.js')

describe('usePreferences', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn()
  })

  it('falls back to the default column order when none is stored yet', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ column_order: [], column_visibility: {}, notes_preview_count: 2 }),
    })

    const { result } = renderHook(() => usePreferences())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.preferences.column_order).toEqual(DEFAULT_COLUMN_ORDER)
  })

  it('uses the stored column order when one exists', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ column_order: ['status', 'priority'], column_visibility: { eta: false }, notes_preview_count: 2 }),
    })

    const { result } = renderHook(() => usePreferences())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.preferences.column_order[0]).toBe('status')
    expect(result.current.preferences.column_visibility).toEqual({ sfdc: false, eta: false })
  })

  it('applies a patch optimistically and PATCHes it to the server', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ column_order: [], column_visibility: {}, notes_preview_count: 2 }),
    })

    const { result } = renderHook(() => usePreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updatePreferences({ column_visibility: { priority: false } })
    })

    expect(result.current.preferences.column_visibility).toEqual({ priority: false })
    const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
    expect(patchCall[0]).toBe('/api/preferences')
    expect(JSON.parse(patchCall[1].body)).toEqual({ column_visibility: { priority: false } })
  })
})
