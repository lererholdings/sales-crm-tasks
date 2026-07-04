import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./[id].js')).default

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

function authedReq(overrides = {}) {
  return {
    method: 'PATCH',
    headers: { authorization: 'Bearer good' },
    query: { id: 'target-id' },
    body: { role: 'admin' },
    ...overrides,
  }
}

describe('PATCH /api/users/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockReset()
  })

  it('returns 403 for a non-admin caller', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }],
    })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(403)
    expect(queryMock).toHaveBeenCalledTimes(1) // only the validateSession lookup, no UPDATE
  })

  it('lets an admin caller update a role', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'caller-id', role: 'admin', display_name: 'Caller', email: 'c@x.com' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'target-id', display_name: 'Target', email: 't@x.com', role: 'admin' }],
      })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.role).toBe('admin')
  })

  it('rejects an invalid role value', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'caller-id', role: 'admin', display_name: 'Caller', email: 'c@x.com' }],
    })

    const res = mockRes()
    await handler(authedReq({ body: { role: 'superadmin' } }), res)

    expect(res.statusCode).toBe(400)
  })
})
