import { useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'

async function request(getToken, method, path, body) {
  const token = await getToken()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // no/invalid JSON body
  }

  if (!res.ok) {
    const error = new Error(data?.error ?? `Request failed with ${res.status}`)
    error.status = res.status
    throw error
  }

  return data
}

// Attaches the current Clerk session token to every request automatically.
// Memoized on getToken so the returned object has a stable identity across
// renders — callers put this in a useEffect/useCallback dependency array.
export function useApiClient() {
  const { getToken } = useAuth()

  return useMemo(
    () => ({
      get: (path) => request(getToken, 'GET', path),
      post: (path, body) => request(getToken, 'POST', path, body),
      patch: (path, body) => request(getToken, 'PATCH', path, body),
      delete: (path) => request(getToken, 'DELETE', path),
    }),
    [getToken],
  )
}
