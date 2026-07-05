import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

// Named useCurrentUser (not useAuth) to avoid colliding with Clerk's own
// useAuth from @clerk/clerk-react, already used elsewhere in this app.
// Backed by GET /api/users?me=true — the internal Supabase user row
// (id/role), not just the Clerk identity.
export function useCurrentUser() {
  const apiClient = useApiClient()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get('/users?me=true')
      setUser(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { user, loading, error, refresh }
}
