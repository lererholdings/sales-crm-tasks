import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./index.js')).default

const CALLER_ROW = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

const FULL_TASK_ROW = {
  id: 'task1',
  task_name: 'RFP response',
  partner_name: null,
  distributor_name: null,
  status: 'backlog',
  priority: 'medium',
  eta: null,
  next_action: null,
  sfdc_task_url: null,
  updated_at: 't',
  deleted_at: null,
  account_id: null,
  account_name: null,
  account_country: null,
  account_acv: null,
  account_sfdc_url: null,
  task_type_id: 'tt1',
  task_type_category: 'pre-sale',
  task_type_name: 'RFP',
  assignee_id: 'assignee1',
  assignee_name: 'Sara',
  updated_by_id: 'caller-id',
  updated_by_name: 'Caller',
}

// Routes by matching against the SQL text rather than positional call
// order — these handlers make many sequential queries (auth lookup,
// validation lookups, insert, re-fetch, notes, audit before/after), and
// pattern-matching is far less brittle than counting exact call indices.
function mockQueryImpl(overrides = {}) {
  return (sql, params) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? CALLER_ROW] }
    if (sql.includes('SELECT id FROM users WHERE id')) {
      return { rows: overrides.assigneeExists === false ? [] : [{ id: params[0] }] }
    }
    if (sql.includes('FROM task_types WHERE id')) {
      return { rows: overrides.taskTypeValid === false ? [] : [{ id: params[0] }] }
    }
    if (sql.includes('INSERT INTO tasks')) return { rows: [{ id: 'task1' }] }
    if (sql.includes('FROM tasks t') && sql.includes('WHERE t.id')) {
      return { rows: [overrides.fullRow ?? FULL_TASK_ROW] }
    }
    if (sql.includes('FROM tasks t')) return { rows: overrides.listRows ?? [FULL_TASK_ROW] }
    if (sql.includes('FROM task_notes n') && sql.includes('ROW_NUMBER')) return { rows: overrides.noteRows ?? [] }
    if (sql.startsWith('SELECT * FROM tasks WHERE id')) return { rows: [overrides.auditAfterRow ?? FULL_TASK_ROW] }
    if (sql.includes('INSERT INTO audit_log')) return {}
    throw new Error(`Unmocked query: ${sql}`)
  }
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

describe('GET /api/tasks', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('lists tasks with notes attached', async () => {
    queryMock.mockImplementation(mockQueryImpl({ noteRows: [{ task_id: 'task1', id: 'n1', content: 'hi', created_at: 't', edited_at: null, user_id: 'u1', user_display_name: 'Sara', total_count: 1 }] }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body[0].task_name).toBe('RFP response')
    expect(res.body[0].notes).toHaveLength(1)
    expect(res.body[0].notes_total).toBe(1)
    expect(res.body[0].account).toBeNull()
    expect(res.body[0].assignee).toEqual({ id: 'assignee1', display_name: 'Sara' })
  })

  it('403s when a non-admin requests include_deleted', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { include_deleted: 'true' } }), res)

    expect(res.statusCode).toBe(403)
  })

  it('allows include_deleted for an admin', async () => {
    queryMock.mockImplementation(mockQueryImpl({ caller: { ...CALLER_ROW, role: 'admin' } }))

    const res = mockRes()
    await handler(authedReq({ query: { include_deleted: 'true' } }), res)

    expect(res.statusCode).toBe(200)
  })

  it('rejects an invalid status filter', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { status: 'not-a-status' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects an invalid priority filter', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { priority: 'not-a-priority' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('applies assignee_id, priority, task_type_id, and partner_name filters together', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(
      authedReq({
        query: { assignee_id: 'assignee1', priority: 'high', task_type_id: 'tt1', partner_name: 'PartnerX' },
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls.find(([s]) => s.includes('FROM tasks t') && !s.includes('WHERE t.id'))
    expect(sql).toContain('t.assignee_id = $1')
    expect(sql).toContain('t.priority = $2')
    expect(sql).toContain('t.task_type_id = $3')
    expect(sql).toContain('t.partner_name ILIKE $4')
    expect(params).toEqual(['assignee1', 'high', 'tt1', '%PartnerX%'])
  })

  it('applies the free-text search filter across task name and notes', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { search: 'pricing' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls.find(([s]) => s.includes('FROM tasks t') && !s.includes('WHERE t.id'))
    expect(sql).toContain('t.task_name ILIKE $1')
    expect(sql).toContain('task_notes n')
    expect(params).toEqual(['%pricing%'])
  })

  it('sorts by an allowlisted column and direction', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { sort_by: 'priority', sort_dir: 'desc' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql] = queryMock.mock.calls.find(([s]) => s.includes('FROM tasks t') && !s.includes('WHERE t.id'))
    expect(sql).toContain('ORDER BY t.priority DESC')
  })

  it('falls back to the default sort column for an unrecognized sort_by (never interpolates raw input)', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { sort_by: 'DROP TABLE tasks;--' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql] = queryMock.mock.calls.find(([s]) => s.includes('FROM tasks t') && !s.includes('WHERE t.id'))
    expect(sql).toContain('ORDER BY t.updated_at ASC')
  })
})

describe('POST /api/tasks', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('rejects when task_name, assignee_id, or task_type_id is missing', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { task_name: 'RFP' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects when assignee_id does not exist', async () => {
    queryMock.mockImplementation(mockQueryImpl({ assigneeExists: false }))

    const res = mockRes()
    await handler(
      authedReq({ method: 'POST', body: { task_name: 'RFP', assignee_id: 'ghost', task_type_id: 'tt1' } }),
      res,
    )

    expect(res.statusCode).toBe(400)
  })

  it('rejects when task_type_id is inactive or does not exist', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskTypeValid: false }))

    const res = mockRes()
    await handler(
      authedReq({ method: 'POST', body: { task_name: 'RFP', assignee_id: 'a1', task_type_id: 'inactive' } }),
      res,
    )

    expect(res.statusCode).toBe(400)
  })

  it('creates a task and logs a created audit entry', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(
      authedReq({ method: 'POST', body: { task_name: 'RFP response', assignee_id: 'assignee1', task_type_id: 'tt1' } }),
      res,
    )

    expect(res.statusCode).toBe(201)
    expect(res.body.task_name).toBe('RFP response')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][3]).toBe('created')
  })
})
