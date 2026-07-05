import { useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

const STORAGE_KEY = 'theme'

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// localStorage/OS preference still drive the very first paint (zero flicker
// — no network round-trip needed to render a theme), but user_preferences.theme
// is now the cross-device source of truth: a GET /api/preferences reconciles
// shortly after mount, and every toggle both persists to localStorage and
// PATCHes the server, matching Milestone 7's "persists across sessions and
// devices" goal without regressing the instant first paint.
export function useTheme() {
  const apiClient = useApiClient()
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    apiClient.get('/preferences').then((data) => {
      if (!cancelled && (data.theme === 'light' || data.theme === 'dark')) {
        setTheme(data.theme)
      }
    })
    return () => {
      cancelled = true
    }
  }, [apiClient])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    apiClient.patch('/preferences', { theme: next })
  }

  return { theme, toggleTheme }
}
