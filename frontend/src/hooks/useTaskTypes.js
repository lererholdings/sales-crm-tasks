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

  // Update local state in place rather than refetching the whole list — a
  // refetch flips `loading` back to true, which (per the conditional
  // rendering in TaskTypesPanel) unmounts and remounts the entire list for
  // a moment, reading as a full-page flash for what's really a one-row
  // change. See design.md section 12, "UI mutations update in place."
  const createTaskType = useCallback(
    async (payload) => {
      const created = await apiClient.post('/task-types', payload)
      setTaskTypes((prev) => [...prev, created])
      return created
    },
    [apiClient],
  )

  const updateTaskType = useCallback(
    async (id, patch) => {
      const updated = await apiClient.patch(`/task-types?id=${id}`, patch)
      setTaskTypes((prev) => prev.map((t) => (t.id === id ? updated : t)))
      return updated
    },
    [apiClient],
  )

  return { taskTypes, loading, error, refresh, createTaskType, updateTaskType }
}
