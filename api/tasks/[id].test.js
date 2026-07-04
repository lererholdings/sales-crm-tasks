import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./[id].js')).default

const CALLER_ROW = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

function fullTaskRow(overrides = {}) {
  return {
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
    ...overrides,
  }
}

// Distinguishes "SELECT id FROM tasks..." (existence checks) from
// "SELECT * FROM tasks..." (withAudit's raw before/after snapshots) from
// the joined TASK_BASE_SELECT ("FROM tasks t ... WHERE t.id") — these three
// query tasks by id for different reasons and must not collide.
//
// The "SELECT * FROM tasks" pattern is stateful (not just pattern-matched):
// withAudit calls it twice (before the handler runs, then after), and for
// a real DB those two calls would see different data once the handler's
// UPDATE has landed. A stateless mock returning the same row both times
// would make every diff look empty regardless of whether diffing actually
// works, so the first call returns the pre-mutation row and subsequent
// calls return the post-mutation one.
function mockQueryImpl(overrides = {}) {
  let auditSnapshotCalls = 0
  return (sql, params) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? CALLER_ROW] }
    if (sql.includes('FROM tasks t') && sql.includes('WHERE t.id')) {
      const row = overrides.fullRow === null ? undefined : (overrides.fullRow ?? fullTaskRow())
      return { rows: row ? [row] : [] }
    }
    if (sql.startsWith('SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL')) {
      return { rows: overrides.notDeletedExists === false ? [] : [{ id: params[0] }] }
    }
    if (sql.startsWith('SELECT id FROM tasks WHERE id')) {
      return { rows: overrides.taskExists === false ? [] : [{ id: params[0] }] }
    }
    if (sql.startsWith('SELECT * FROM tasks WHERE id')) {
      if (overrides.taskExists === false) return { rows: [] }
      auditSnapshotCalls += 1
      const snapshot =
        auditSnapshotCalls === 1 ? (overrides.auditBefore ?? fullTaskRow()) : (overrides.auditAfter ?? fullTaskRow())
      return { rows: [snapshot] }
    }
    if (sql.includes('UPDATE tasks SET')) return {}
    if (sql.includes('SELECT id FROM task_notes WHERE task_id')) {
      return { rows: overrides.notesToDelete ?? [] }
    }
    if (sql.includes('UPDATE task_notes SET')) return {}
    if (sql.includes('FROM task_notes n') && sql.includes('LIMIT')) return { rows: overrides.noteRows ?? [] }
    if (sql.includes('SELECT count(*) FROM task_notes')) return { rows: [{ count: String(overrides.notesTotal ?? 0) }] }
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
  return { method: 'GET', query: { id: 'task1' }, headers: { authorization: 'Bearer good' }, ...overrides }
}

describe('GET /api/tasks/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('returns the task with paginated notes', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        noteRows: [{ id: 'n1', content: 'hi', created_at: 't', edited_at: null, user_id: 'u1', user_display_name: 'Sara' }],
        notesTotal: 5,
      }),
    )

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.task_name).toBe('RFP response')
    expect(res.body.notes).toHaveLength(1)
    expect(res.body.notes_total).toBe(5)
  })

  it('404s for a nonexistent task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ fullRow: null }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(404)
  })

  it('hides a soft-deleted task from a non-admin (404)', async () => {
    queryMock.mockImplementation(mockQueryImpl({ fullRow: fullTaskRow({ deleted_at: 't' }) }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(404)
  })

  it('403s when a non-admin requests include_deleted', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ query: { id: 'task1', include_deleted: 'true' } }), res)

    expect(res.statusCode).toBe(403)
  })

  it('shows a soft-deleted task to an admin with include_deleted=true', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({ caller: { ...CALLER_ROW, role: 'admin' }, fullRow: fullTaskRow({ deleted_at: 't' }) }),
    )

    const res = mockRes()
    await handler(authedReq({ query: { id: 'task1', include_deleted: 'true' } }), res)

    expect(res.statusCode).toBe(200)
  })
})

describe('PATCH /api/tasks/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('400s with no updatable fields', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: {} }), res)

    expect(res.statusCode).toBe(400)
  })

  it('404s for a nonexistent task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskExists: false }))

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { status: 'in_progress' } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('updates the task and logs an updated audit entry with the diff', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        auditBefore: fullTaskRow({ status: 'backlog' }),
        auditAfter: fullTaskRow({ status: 'in_progress' }),
        fullRow: fullTaskRow({ status: 'in_progress' }),
      }),
    )

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { status: 'in_progress' } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBe('in_progress')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][3]).toBe('updated')
    expect(JSON.parse(auditCall[1][4])).toEqual({ status: { from: 'backlog', to: 'in_progress' } })
  })
})

describe('DELETE /api/tasks/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('404s for an already-deleted or nonexistent task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ notDeletedExists: false }))

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(404)
  })

  it('soft-deletes the task, cascades notes, and writes two audit entries', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        notesToDelete: [{ id: 'n1' }, { id: 'n2' }],
        auditBefore: fullTaskRow({ deleted_at: null, deleted_by: null }),
        auditAfter: fullTaskRow({ deleted_at: 't', deleted_by: 'caller-id' }),
      }),
    )

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ deleted: true, notes_deleted: 2 })

    const auditInserts = queryMock.mock.calls.filter(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditInserts).toHaveLength(2)
    const actions = auditInserts.map(([, params]) => params[3])
    expect(actions).toEqual(['deleted', 'deleted'])
    const cascadeCall = auditInserts.find(([, params]) => JSON.parse(params[4]).notes_deleted)
    expect(JSON.parse(cascadeCall[1][4])).toEqual({ notes_deleted: { from: 0, to: 2 } })
  })

  it('writes only one audit entry when there were no notes to cascade', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        notesToDelete: [],
        auditBefore: fullTaskRow({ deleted_at: null, deleted_by: null }),
        auditAfter: fullTaskRow({ deleted_at: 't', deleted_by: 'caller-id' }),
      }),
    )

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.body.notes_deleted).toBe(0)
    const auditInserts = queryMock.mock.calls.filter(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditInserts).toHaveLength(1)
  })
})
