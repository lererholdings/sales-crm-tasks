import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

const PAGE_SIZE = 20

// Task-scoped audit history, "load more" accumulating like useTask.js's
// notes rather than the admin log's page-replace pagination — a task's own
// history is meant to read as one growing timeline, not paged results.
// GET /api/audit-log allows any authenticated user through when task_id is
// set (see api/audit-log/index.js), so this isn't admin-gated.
export function useTaskHistory(taskId) {
  const apiClient = useApiClient()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get(`/audit-log?task_id=${taskId}&limit=${PAGE_SIZE}&offset=0`)
      setEntries(data.entries)
      setTotal(data.total)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, taskId])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (!taskId) return
    const data = await apiClient.get(`/audit-log?task_id=${taskId}&limit=${PAGE_SIZE}&offset=${entries.length}`)
    setEntries((prev) => [...prev, ...data.entries])
    setTotal(data.total)
  }, [apiClient, taskId, entries.length])

  return { entries, total, loading, error, loadMore }
}
