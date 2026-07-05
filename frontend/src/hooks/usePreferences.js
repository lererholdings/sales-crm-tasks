import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'
import { DEFAULT_COLUMN_ORDER, normalizeColumnOrder } from '../lib/columns.js'

const DEFAULT_PREFERENCES = {
  column_order: DEFAULT_COLUMN_ORDER,
  column_visibility: {},
  notes_preview_count: 2,
}

export function usePreferences() {
  const apiClient = useApiClient()
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/preferences')
      .then((data) => {
        if (cancelled) return
        setPreferences({
          column_order: normalizeColumnOrder(data.column_order),
          column_visibility: data.column_visibility ?? {},
          notes_preview_count: data.notes_preview_count ?? 2,
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiClient])

  // Applies the patch locally first so column toggles/reorders feel instant,
  // then persists it — matches the PATCH endpoint's partial-update semantics.
  const updatePreferences = useCallback(
    (patch) => {
      setPreferences((prev) => ({ ...prev, ...patch }))
      return apiClient.patch('/preferences', patch)
    },
    [apiClient],
  )

  return { preferences, loading, updatePreferences }
}
