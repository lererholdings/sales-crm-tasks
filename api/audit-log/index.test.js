import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./index.js')).default

const MEMBER_ROW = { id: 'u1', role: 'member', display_name: 'Member', email: 'm@x.com' }
const ADMIN_ROW = { id: 'u1', role: 'admin', display_name: 'Admin', email: 'a@x.com' }

const ENTRY_ROW = {
  id: 'log1',
  entity_type: 'task',
  entity_id: 'task1',
  action: 'updated',
  changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
  timestamp: '2026-06-15T10:00:00Z',
  user_id: 'u2',
  user_display_name: 'John',
  task_id: 'task1',
  account_id: null,
  task_name: 'RFP response',
}

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

function mockQueryImpl(overrides = {}) {
  const entries = overrides.entries ?? [ENTRY_ROW]
  return (sql) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? ADMIN_ROW] }
    if (sql.includes('COUNT(1)')) return { rows: [{ total: String(overrides.total ?? entries.length) }] }
    if (sql.includes('FROM audit_log a')) return { rows: entries }
    throw new Error(`Unmocked query: ${sql}`)
  }
}

describe('GET /api/audit-log', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('403s for a non-admin with no task_id (unscoped access)', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: MEMBER_ROW }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(403)
  })

  it('allows a non-admin when task_id is set, scoped to that task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: MEMBER_ROW }))

    const res = mockRes()
    await handler(authedReq({ query: { task_id: 'task1' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls[2]
    expect(sql).toContain('a.task_id = $1')
    expect(params[0]).toBe('task1')
  })

  it('lists entries with the user shape and changed_fields, newest first', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.entries[0]).toEqual({
      id: 'log1',
      entity_type: 'task',
      entity_id: 'task1',
      entity_label: 'RFP response',
      entity_link: { type: 'task', id: 'task1' },
      user: { id: 'u2', display_name: 'John' },
      action: 'updated',
      changed_fields: { status: { from: 'backlog', to: 'in_progress' } },
      timestamp: '2026-06-15T10:00:00Z',
      task_id: 'task1',
      account_id: null,
    })
    expect(res.body.total).toBe(1)
    const [sql] = queryMock.mock.calls[2]
    expect(sql).toContain('ORDER BY a.timestamp DESC')
    // Regression guard: toEntry() reads row.task_id/row.account_id, but a
    // mocked row has them regardless of what's actually selected — this is
    // the only thing that would have caught the real SELECT list missing
    // those two columns (found via live verification, not this suite).
    expect(sql).toContain('a.task_id')
    expect(sql).toContain('a.account_id')
  })

  it('returns user: null when the actor was deleted (user_id set null on delete)', async () => {
    queryMock.mockImplementation(mockQueryImpl({ entries: [{ ...ENTRY_ROW, user_id: null, user_display_name: null }] }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.body.entries[0].user).toBeNull()
  })

  it('includes a COUNT(1) total reflecting the same filters, without the user join', async () => {
    queryMock.mockImplementation(mockQueryImpl({ total: 42 }))

    const res = mockRes()
    await handler(authedReq({ query: { entity_type: 'task' } }), res)

    expect(res.body.total).toBe(42)
    const [countSql, countParams] = queryMock.mock.calls[1]
    expect(countSql).toContain('SELECT COUNT(1) AS total FROM audit_log a')
    expect(countSql).not.toContain('LEFT JOIN')
    expect(countSql).toContain('a.entity_type = $1')
    expect(countParams).toEqual(['task'])
  })

  it('filters by user_id, entity_type, action, and date range together', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(
      authedReq({
        query: { user_id: 'u2', entity_type: 'task', action: 'updated', from: '2026-06-01', to: '2026-06-30' },
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls[2]
    expect(sql).toContain('a.user_id = $1')
    expect(sql).toContain('a.entity_type = $2')
    expect(sql).toContain('a.action = $3')
    expect(sql).toContain('a.timestamp >= $4')
    expect(sql).toContain('a.timestamp <= $5')
    expect(params.slice(0, 5)).toEqual(['u2', 'task', 'updated', '2026-06-01', '2026-06-30'])
  })

  it('rejects an invalid entity_type', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { entity_type: 'not-a-type' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects an invalid action', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { action: 'not-an-action' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('defaults limit to 100 and offset to 0', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    const [, params] = queryMock.mock.calls[2]
    expect(params).toEqual([100, 0])
  })

  it('honors limit and offset query params, capped at the max limit', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { limit: '9999', offset: '50' } }), res)

    expect(res.statusCode).toBe(200)
    const [, params] = queryMock.mock.calls[2]
    expect(params[0]).toBe(500) // capped at MAX_LIMIT
    expect(params[1]).toBe(50)
  })
})

describe('entity label and link resolution', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  async function entryFor(overrides) {
    queryMock.mockImplementation(mockQueryImpl({ entries: [{ ...ENTRY_ROW, ...overrides }] }))
    const res = mockRes()
    await handler(authedReq(), res)
    return res.body.entries[0]
  }

  it('task_note links to its parent task and reads "Note on <task name>"', async () => {
    const entry = await entryFor({
      entity_type: 'task_note',
      entity_id: 'note1',
      task_id: 'task1',
      task_name: 'RFP response',
    })

    expect(entry.entity_label).toBe('Note on RFP response')
    expect(entry.entity_link).toEqual({ type: 'task', id: 'task1' })
  })

  it('account links to the account and shows its name', async () => {
    const entry = await entryFor({
      entity_type: 'account',
      entity_id: 'acc1',
      task_id: null,
      account_id: 'acc1',
      account_name: 'Acme Corp',
      task_name: null,
    })

    expect(entry.entity_label).toBe('Acme Corp')
    expect(entry.entity_link).toEqual({ type: 'account', id: 'acc1' })
  })

  it('user links to the Users tab (not a per-item page) and shows the target user\'s name', async () => {
    const entry = await entryFor({
      entity_type: 'user',
      entity_id: 'u3',
      task_id: null,
      task_name: null,
      target_user_name: 'Sara',
    })

    expect(entry.entity_label).toBe('Sara')
    expect(entry.entity_link).toEqual({ type: 'user' })
  })

  it('task_type links to the Task Types tab and shows "category · name"', async () => {
    const entry = await entryFor({
      entity_type: 'task_type',
      entity_id: 'tt1',
      task_id: null,
      task_name: null,
      task_type_category: 'pre-sale',
      task_type_name: 'RFP',
    })

    expect(entry.entity_label).toBe('pre-sale · RFP')
    expect(entry.entity_link).toEqual({ type: 'task_type' })
  })

  it('falls back to a short id label with no link when the joined name is missing', async () => {
    const entry = await entryFor({
      entity_type: 'task_note',
      entity_id: 'orphan-note-12345678',
      task_id: null,
      task_name: null,
    })

    expect(entry.entity_label).toBe('task_note · orphan-n')
    expect(entry.entity_link).toBeNull()
  })
})
