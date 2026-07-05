import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

// A literal `{}` default parameter would be re-evaluated (a new reference)
// on every call with no argument — see useTasks.js for why that matters.
const EMPTY_FILTERS = {}

// filters: { search, country, sort_by, sort_dir, includeAcv } passed
// through as GET /api/accounts query params (includeAcv maps to the
// existing ?include=acv param). Keep this object referentially stable
// across renders (e.g. one useState in AccountsPage), same reasoning as
// useTasks.js.
export function useAccounts(filters = EMPTY_FILTERS) {
  const apiClient = useApiClient()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const { includeAcv, ...rest } = filters
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined && value !== null && value !== '') params.set(key, value)
      }
      if (includeAcv) params.set('include', 'acv')
      const qs = params.toString()
      const data = await apiClient.get(`/accounts${qs ? `?${qs}` : ''}`)
      setAccounts(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { accounts, loading, error, refresh }
}
