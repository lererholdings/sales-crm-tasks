import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./index.js')).default

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
    },
  }
}

describe('GET /api/users', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockReset()
  })

  it('returns the user list with roles for any authenticated user', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'caller-id', display_name: 'Caller', email: 'c@x.com', role: 'member' },
          { id: 'u2', display_name: 'Sara', email: 'sara@x.com', role: 'admin' },
        ],
      })

    const res = mockRes()
    await handler({ method: 'GET', headers: { authorization: 'Bearer good' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[1]).toEqual({ id: 'u2', display_name: 'Sara', email: 'sara@x.com', role: 'admin' })
  })

  it('401s with no Authorization header', async () => {
    const res = mockRes()
    await handler({ method: 'GET', headers: {} }, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Missing bearer token', code: 'UNAUTHORIZED' })
  })

  it('?me=true returns only the caller, without listing everyone', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }],
    })

    const res = mockRes()
    await handler({ method: 'GET', query: { me: 'true' }, headers: { authorization: 'Bearer good' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ id: 'caller-id', display_name: 'Caller', email: 'c@x.com', role: 'member' })
    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
