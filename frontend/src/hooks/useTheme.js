import { useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

// Local-only for now (localStorage). Milestone 7 swaps this for a DB-backed
// version (user_preferences.theme + PATCH /api/preferences) so it syncs
// across devices — same toggle/OS-detection logic, different persistence.
function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
