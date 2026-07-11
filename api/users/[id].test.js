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

const CALLER_ADMIN = { id: 'caller-id', role: 'admin', display_name: 'Caller', email: 'c@x.com' }
const CALLER_MEMBER = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

// Mirrors api/task-types/index.test.js's convention: "SELECT * FROM users
// WHERE id" is stateful since withAudit calls it twice (before/after), so
// the first call returns the pre-mutation row and the next returns the
// post-mutation one.
function mockQueryImpl(overrides = {}) {
  let auditSnapshotCalls = 0
  return (sql) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? CALLER_ADMIN] }
    if (sql.includes('SELECT * FROM users WHERE id')) {
      auditSnapshotCalls += 1
      const snapshot =
        auditSnapshotCalls === 1
          ? (overrides.auditBeforeRow ?? { id: 'target-id', display_name: 'Target', email: 't@x.com', role: 'member' })
          : (overrides.auditAfterRow ?? { id: 'target-id', display_name: 'Target', email: 't@x.com', role: 'admin' })
      return { rows: [snapshot] }
    }
    if (sql.startsWith('UPDATE users')) {
      return {
        rows: overrides.updateRows ?? [{ id: 'target-id', display_name: 'Target', email: 't@x.com', role: 'admin' }],
      }
    }
    if (sql.includes('INSERT INTO audit_log')) return {}
    throw new Error(`Unmocked query: ${sql}`)
  }
}

describe('PATCH /api/users/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'caller' })
  })

  it('returns 403 for a non-admin caller', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: CALLER_MEMBER }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(403)
    expect(queryMock.mock.calls.some(([sql]) => sql.startsWith('UPDATE users'))).toBe(false)
  })

  it('lets an admin caller update a role and logs an updated audit entry', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.role).toBe('admin')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1]).toEqual(['user', 'target-id', 'caller-id', 'updated', JSON.stringify({ role: { from: 'member', to: 'admin' } })])
  })

  it('rejects an invalid role value', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ body: { role: 'superadmin' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the target user does not exist', async () => {
    queryMock.mockImplementation(mockQueryImpl({ updateRows: [] }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(404)
  })
})
