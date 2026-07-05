import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'
import { DEFAULT_COLUMN_ORDER, normalizeTaskColumnOrder } from '../lib/columns.js'
import {
  DEFAULT_ACCOUNT_COLUMN_ORDER,
  DEFAULT_ACCOUNT_COLUMN_VISIBILITY,
  normalizeAccountColumnOrder,
} from '../lib/accountColumns.js'

const DEFAULT_PREFERENCES = {
  column_order: DEFAULT_COLUMN_ORDER,
  column_visibility: {},
  notes_preview_count: 2,
  accounts_column_order: DEFAULT_ACCOUNT_COLUMN_ORDER,
  accounts_column_visibility: DEFAULT_ACCOUNT_COLUMN_VISIBILITY,
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
          column_order: normalizeTaskColumnOrder(data.column_order),
          column_visibility: data.column_visibility ?? {},
          notes_preview_count: data.notes_preview_count ?? 2,
          accounts_column_order: normalizeAccountColumnOrder(data.accounts_column_order),
          // Layered, not just a nullish fallback: an unset `acv` key must
          // still resolve to hidden (the DB default is `{}`, not `{acv:
          // false}`), while an explicit `{ acv: true }` the user saved
          // still overrides it.
          accounts_column_visibility: { ...DEFAULT_ACCOUNT_COLUMN_VISIBILITY, ...data.accounts_column_visibility },
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
