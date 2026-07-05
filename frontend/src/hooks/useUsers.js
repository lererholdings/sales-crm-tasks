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

  return { users, loading, error, refresh }
}
