import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

export function useUsers() {
  const apiClient = useApiClient()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get('/users')
      setUsers(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Update local state in place rather than refetching the whole list —
  // see useTaskTypes.js / design.md section 12, "UI mutations update in
  // place," for why a refetch-driven re-render reads as a full-page flash.
  const updateUserRole = useCallback(
    async (id, role) => {
      const updated = await apiClient.patch(`/users/${id}`, { role })
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
      return updated
    },
    [apiClient],
  )

  return { users, loading, error, refresh, updateUserRole }
}
