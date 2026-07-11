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

const MEMBER_ROW = { id: 'u1', role: 'member', display_name: 'Member', email: 'm@x.com' }
const ADMIN_ROW = { id: 'u1', role: 'admin', display_name: 'Admin', email: 'a@x.com' }

// Routes by matching against the SQL text — mirrors api/tasks/[id]/index.test.js's
// convention. "SELECT * FROM task_types WHERE id" is stateful, not just
// pattern-matched: withAudit calls it twice (before the handler runs, then
// after), so the first call returns the pre-mutation row and subsequent
// calls return the post-mutation one — otherwise every diff would look
// empty regardless of whether diffing actually works.
function mockQueryImpl(overrides = {}) {
  let auditSnapshotCalls = 0
  return (sql, params) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? ADMIN_ROW] }
    if (sql.includes('SELECT * FROM task_types WHERE id')) {
      auditSnapshotCalls += 1
      const snapshot =
        auditSnapshotCalls === 1
          ? (overrides.auditBeforeRow ?? { id: 't1', category: 'pre-sale', name: 'Demo', active: true })
          : (overrides.auditAfterRow ?? { id: 't1', category: 'pre-sale', name: 'Demo Updated', active: false })
      return { rows: [snapshot] }
    }
    if (sql.includes('INSERT INTO task_types')) return { rows: [{ id: 't1' }] }
    if (sql.startsWith('SELECT id, category, name, active FROM task_types WHERE id')) {
      return { rows: [overrides.fullRow ?? { id: 't1', category: 'pre-sale', name: 'Demo', active: true }] }
    }
    if (sql.startsWith('UPDATE task_types')) {
      return { rows: overrides.updateRows ?? [{ id: 't1', category: 'pre-sale', name: 'Demo Updated', active: false }] }
    }
    if (sql.includes('INSERT INTO audit_log')) return {}
    throw new Error(`Unmocked query: ${sql}`)
  }
}

describe('POST /api/task-types', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('403s for a non-admin', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: MEMBER_ROW }))

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { category: 'pre-sale', name: 'Workshop' } }), res)

    expect(res.statusCode).toBe(403)
  })

  it('rejects an invalid category', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { category: 'not-a-category', name: 'Workshop' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a missing name', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { category: 'pre-sale' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('creates a task type and logs a created audit entry', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { category: 'pre-sale', name: 'Workshop' } }), res)

    expect(res.statusCode).toBe(201)
    expect(res.body.name).toBe('Demo') // from the mocked re-fetch row

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][3]).toBe('created')
  })
})

describe('PATCH /api/task-types', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('403s for a non-admin', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: MEMBER_ROW }))

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', query: { id: 't1' }, body: { active: false } }), res)

    expect(res.statusCode).toBe(403)
  })

  it('rejects when id query param is missing', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { active: false } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects an empty body', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', query: { id: 't1' }, body: {} }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-boolean active value', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', query: { id: 't1' }, body: { active: 'yes' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('updates name and active, and logs an updated audit entry', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', query: { id: 't1' }, body: { name: 'Demo Updated', active: false } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.name).toBe('Demo Updated')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][3]).toBe('updated')
  })

  it('404s when the task type does not exist', async () => {
    queryMock.mockImplementation(mockQueryImpl({ updateRows: [] }))

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', query: { id: 'ghost' }, body: { active: false } }), res)

    expect(res.statusCode).toBe(404)
  })
})
