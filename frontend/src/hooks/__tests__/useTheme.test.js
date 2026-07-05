import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const { useTheme } = await import('../useTheme.js')

function mockMatchMedia(prefersDark) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: prefersDark })
}

function mockFetch(preferencesTheme) {
  global.fetch = vi.fn((url, opts) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: async () => ({ theme: JSON.parse(opts.body).theme }) })
    return Promise.resolve({ ok: true, json: async () => ({ theme: preferencesTheme ?? null }) })
  })
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    getTokenMock.mockReset()
    getTokenMock.mockResolvedValue('token')
    mockFetch(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to light when no stored preference and OS prefers light', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('falls back to dark when no stored preference and OS prefers dark', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('a stored preference overrides the OS preference', () => {
    mockMatchMedia(true)
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggleTheme flips the theme, updates the DOM, and persists to localStorage', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('reconciles with a theme saved server-side, overriding the local/OS fallback', async () => {
    mockMatchMedia(false)
    mockFetch('dark')

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light') // instant first paint, before the fetch resolves

    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('does not override the local fallback when the server has no saved theme yet', async () => {
    mockMatchMedia(true)
    mockFetch(null)

    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/preferences', expect.anything()))

    expect(result.current.theme).toBe('dark')
  })

  it('toggleTheme fires a PATCH /api/preferences call with the new theme', async () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/preferences', expect.anything()))

    act(() => result.current.toggleTheme())

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH')
      expect(patchCall).toBeDefined()
      expect(patchCall[0]).toBe('/api/preferences')
      expect(JSON.parse(patchCall[1].body)).toEqual({ theme: 'dark' })
    })
  })
})
