import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../_lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

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

function authedReq(overrides = {}) {
  return { method: 'GET', query: {}, headers: { authorization: 'Bearer good' }, ...overrides }
}

describe('GET /api/task-types', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockReset()
  })

  it('members only see active task types', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_member' })
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'member', display_name: 'Member', email: 'm@x.com' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1', category: 'pre-sale', name: 'Demo', active: true }] })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    const [sql] = queryMock.mock.calls[1]
    expect(sql).toContain('WHERE active = true')
  })

  it('admins see all task types including inactive ones', async () => {
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_admin' })
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'admin', display_name: 'Admin', email: 'a@x.com' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 't1', category: 'pre-sale', name: 'Demo', active: true },
          { id: 't2', category: 'pre-sale', name: 'Old type', active: false },
        ],
      })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.body).toHaveLength(2)
    const [sql] = queryMock.mock.calls[1]
    expect(sql).not.toContain('WHERE')
  })
})
