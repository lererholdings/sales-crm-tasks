// Fired by apiClient when a request is still 401 after a forced token
// refresh — i.e. the Clerk session is genuinely gone, not just a stale
// cached token. ProtectedRoute listens for this to redirect to sign-in.
// A window event (rather than apiClient calling Clerk's useClerk() directly)
// keeps apiClient free of any Clerk hook dependency, since useApiClient is
// consumed far outside React's component tree assumptions in tests.
export const SESSION_EXPIRED_EVENT = 'session-expired'

export function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { returnUrl: window.location.href } }))
}
