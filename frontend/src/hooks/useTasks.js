import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

// A literal `{}` default parameter would be re-evaluated (a new reference)
// on every call with no argument — this constant keeps the no-filters case
// referentially stable too, for the same reason described below.
const EMPTY_FILTERS = {}

// filters: { status, assignee_id, priority, task_type_id, partner_name, search, sort_by, sort_dir }
// passed straight through as GET /api/tasks query params. Callers should keep
// this object referentially stable (e.g. one useState in TasksPage, updated
// immutably) so refresh's identity — and this effect — only changes when a
// filter actually changes, not on every unrelated re-render.
export function useTasks(filters = EMPTY_FILTERS) {
  const apiClient = useApiClient()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          if (value.length > 0) params.set(key, value.join(','))
        } else if (value !== undefined && value !== null && value !== '') {
          params.set(key, value)
        }
      }
      const qs = params.toString()
      const data = await apiClient.get(qs ? `/tasks?${qs}` : '/tasks')
      setTasks(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, filters])

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
