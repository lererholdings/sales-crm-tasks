import { useClerk, useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { SESSION_EXPIRED_EVENT } from '../../lib/sessionEvents.js'

// Unauthenticated users are redirected to Clerk's hosted login.
// Clerk returns them to the page they originally requested after sign-in.
export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useUser()
  const { redirectToSignIn } = useClerk()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirectToSignIn({ redirectUrl: window.location.href })
    }
  }, [isLoaded, isSignedIn, redirectToSignIn])

  // A request coming back 401 even after apiClient forces a fresh token
  // means the session is genuinely gone — don't wait for Clerk's own
  // client-side state to catch up, redirect immediately with the page the
  // user was on so they land back here after signing back in.
  useEffect(() => {
    const handleSessionExpired = (event) => {
      redirectToSignIn({ redirectUrl: event.detail.returnUrl })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [redirectToSignIn])

  if (!isLoaded || !isSignedIn) {
    return null
  }

  return children
}
