import { useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { dispatchSessionExpired } from './sessionEvents.js'

async function doFetch(token, method, path, body) {
  return fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function request(getToken, method, path, body) {
  const token = await getToken()
  let res = await doFetch(token, method, path, body)

  if (res.status === 401) {
    // The cached token might just be stale — Clerk refreshes it in the
    // background, but a request can race that. Force a fresh one and retry
    // exactly once before treating this as a real session expiry.
    const freshToken = await getToken({ skipCache: true })
    res = await doFetch(freshToken, method, path, body)
  }

  if (res.status === 401) {
    // Still unauthorized after a forced refresh: the session is genuinely
    // gone (expired/revoked), not just a stale cache. Send the user to sign
    // back in rather than showing a raw error for a broken session.
    dispatchSessionExpired()
    const error = new Error('Session expired')
    error.status = 401
    throw error
  }

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
