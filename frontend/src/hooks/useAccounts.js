import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

export function useAccounts({ search } = {}) {
  const apiClient = useApiClient()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const qs = params.toString()
      const data = await apiClient.get(`/accounts${qs ? `?${qs}` : ''}`)
      setAccounts(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, search])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { accounts, loading, error, refresh }
}
