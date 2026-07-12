import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useUserMock = vi.fn()
const redirectToSignInMock = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => useUserMock(),
  useClerk: () => ({ redirectToSignIn: redirectToSignInMock }),
}))

const { default: ProtectedRoute } = await import('../ProtectedRoute.jsx')
const { SESSION_EXPIRED_EVENT } = await import('../../../lib/sessionEvents.js')

describe('ProtectedRoute', () => {
  beforeEach(() => {
    redirectToSignInMock.mockReset()
  })

  it('renders children when signed in', () => {
    useUserMock.mockReturnValue({ isLoaded: true, isSignedIn: true })

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Protected content')).toBeTruthy()
    expect(redirectToSignInMock).not.toHaveBeenCalled()
  })

  it('redirects to sign-in when not signed in, and renders nothing', () => {
    useUserMock.mockReturnValue({ isLoaded: true, isSignedIn: false })

    const { container } = render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    )

    expect(container.textContent).toBe('')
    expect(redirectToSignInMock).toHaveBeenCalledWith({ redirectUrl: window.location.href })
  })

  it('redirects to sign-in, preserving the return URL, on a session-expired event', () => {
    useUserMock.mockReturnValue({ isLoaded: true, isSignedIn: true })

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    )

    act(() => {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { returnUrl: 'http://localhost/tasks?taskId=t1' } }),
      )
    })

    expect(redirectToSignInMock).toHaveBeenCalledWith({ redirectUrl: 'http://localhost/tasks?taskId=t1' })
  })
})
