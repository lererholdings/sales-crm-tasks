import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('./db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
const getUserMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: (...args) => getUserMock(...args) } }),
}))

const { validateSession } = await import('./auth.js')

function mockReq(headers = {}) {
  return { headers }
}

describe('validateSession', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockReset()
    getUserMock.mockReset()
  })

  it('rejects a request with no Authorization header', async () => {
    await expect(validateSession(mockReq())).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a malformed Authorization header', async () => {
    await expect(validateSession(mockReq({ authorization: 'Token abc' }))).rejects.toMatchObject({
      status: 401,
    })
  })

  it('rejects when Clerk verification throws (expired/invalid token)', async () => {
    verifyTokenMock.mockRejectedValue(new Error('expired'))
    await expect(validateSession(mockReq({ authorization: 'Bearer bad' }))).rejects.toMatchObject({
      status: 401,
    })
  })

  it('resolves an existing user by clerk_user_id without provisioning', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_1' })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', role: 'member', display_name: 'Sara', email: 'sara@x.com' }],
    })

    const user = await validateSession(mockReq({ authorization: 'Bearer good' }))

    expect(user).toEqual({
      id: 'u1',
      role: 'member',
      clerkUserId: 'clerk_1',
      displayName: 'Sara',
      email: 'sara@x.com',
    })
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('auto-provisions a new user on first login', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_2' })
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 'u2', role: 'member', display_name: 'John Doe', email: 'john@x.com' }],
      })
    getUserMock.mockResolvedValue({
      firstName: 'John',
      lastName: 'Doe',
      primaryEmailAddressId: 'em1',
      emailAddresses: [{ id: 'em1', emailAddress: 'john@x.com' }],
    })

    const user = await validateSession(mockReq({ authorization: 'Bearer good' }))

    expect(user).toEqual({
      id: 'u2',
      role: 'member',
      clerkUserId: 'clerk_2',
      displayName: 'John Doe',
      email: 'john@x.com',
    })
    expect(queryMock).toHaveBeenCalledTimes(2)
  })

  it('does not re-provision on a second login for the same user', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_3' })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u3', role: 'member', display_name: 'Amy', email: 'amy@x.com' }],
    })

    await validateSession(mockReq({ authorization: 'Bearer good' }))

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(getUserMock).not.toHaveBeenCalled()
  })
})
