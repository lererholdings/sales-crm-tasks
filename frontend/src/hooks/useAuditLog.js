import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

const EMPTY_FILTERS = {}

// filters: { user_id, entity_type, action, from, to, limit, offset } passed
// through as GET /api/audit-log query params. Keep this object referentially
// stable across renders (one useState in AuditLogPanel) — see useTasks.js
// for why that matters.
export function useAuditLog(filters = EMPTY_FILTERS) {
  const apiClient = useApiClient()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') params.set(key, value)
      }
      const qs = params.toString()
      const data = await apiClient.get(`/audit-log${qs ? `?${qs}` : ''}`)
      setEntries(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { entries, loading, error, refresh }
}
