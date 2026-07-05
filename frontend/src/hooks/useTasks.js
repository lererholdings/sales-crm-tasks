import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

export function useTasks() {
  const apiClient = useApiClient()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get('/tasks')
      setTasks(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { tasks, loading, error, refresh }
}
