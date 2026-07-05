import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useAccounts } = await import('../useAccounts.js')

describe('useAccounts', () => {
  beforeEach(() => {
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('fetches the plain endpoint when no filters are given', async () => {
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts', expect.anything())
  })

  it('passes search and country through as query params', async () => {
    const filters = { search: 'Acme', country: 'Australia' }
    const { result } = renderHook(() => useAccounts(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts?search=Acme&country=Australia', expect.anything())
  })

  it('passes sort_by/sort_dir through as query params', async () => {
    const filters = { sort_by: 'acv', sort_dir: 'desc' }
    const { result } = renderHook(() => useAccounts(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts?sort_by=acv&sort_dir=desc', expect.anything())
  })

  it('maps includeAcv:true to the existing include=acv param', async () => {
    const filters = { includeAcv: true }
    const { result } = renderHook(() => useAccounts(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts?include=acv', expect.anything())
  })

  it('omits include entirely when includeAcv is false', async () => {
    const filters = { includeAcv: false }
    const { result } = renderHook(() => useAccounts(filters))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledWith('/api/accounts', expect.anything())
  })
})
