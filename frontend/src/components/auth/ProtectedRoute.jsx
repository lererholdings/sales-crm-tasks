import { useClerk, useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'

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

  if (!isLoaded || !isSignedIn) {
    return null
  }

  return children
}
