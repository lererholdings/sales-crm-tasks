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

  // Merges a patch into one task by id, without refetching the whole list —
  // used after edits made in TaskSidePanel so only that row's object
  // reference changes (see TaskRow's React.memo, which relies on this to
  // skip re-rendering every other row).
  const updateTaskInPlace = useCallback((taskId, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
  }, [])

  return { tasks, loading, error, refresh, updateTaskInPlace }
}
