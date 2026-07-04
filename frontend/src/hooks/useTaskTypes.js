import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

export function useTaskTypes() {
  const apiClient = useApiClient()
  const [taskTypes, setTaskTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get('/task-types')
      setTaskTypes(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { taskTypes, loading, error, refresh }
}
