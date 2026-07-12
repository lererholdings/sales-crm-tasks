import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./[noteId].js')).default

const CALLER_ROW = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

function noteRow(overrides = {}) {
  return {
    id: 'note1',
    task_id: 'task1',
    content: 'Sent draft',
    created_at: 't1',
    edited_at: null,
    user_id: 'caller-id',
    user_display_name: 'Caller',
    last_updated_by_id: null,
    last_updated_by_name: null,
    ...overrides,
  }
}

// Same stateful-snapshot need as api/tasks/[id]/index.test.js: withAudit
// calls "SELECT * FROM task_notes WHERE id" twice (before the handler's
// UPDATE, then after), so the mock must return different rows per call for
// a diff to be observable at all.
function mockQueryImpl(overrides = {}) {
  let auditSnapshotCalls = 0
  return (sql, params) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? CALLER_ROW] }
    if (sql.startsWith('SELECT id, task_id, user_id, created_at FROM task_notes WHERE id')) {
      if (overrides.noteExists === false) return { rows: [] }
      return {
        rows: [
          overrides.existingNote ?? {
            id: params[0],
            task_id: 'task1',
            user_id: 'caller-id',
            created_at: 't1',
          },
        ],
      }
    }
    if (sql.startsWith('SELECT id FROM task_notes WHERE task_id')) {
      return { rows: overrides.newerNotes ?? [] }
    }
    if (sql.includes('UPDATE task_notes SET')) return {}
    if (sql.includes('FROM task_notes n') && sql.includes('WHERE n.id = $1')) {
      return { rows: [overrides.updatedNoteFull ?? noteRow({ edited_at: 't2' })] }
    }
    if (sql.startsWith('SELECT * FROM task_notes WHERE id')) {
      auditSnapshotCalls += 1
      const snapshot = auditSnapshotCalls === 1 ? (overrides.auditBefore ?? noteRow()) : (overrides.auditAfter ?? noteRow())
      return { rows: [snapshot] }
    }
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
  return {
    method: 'PATCH',
    query: { id: 'task1', noteId: 'note1' },
    headers: { authorization: 'Bearer good' },
    ...overrides,
  }
}

describe('PATCH /api/tasks/:id/notes/:noteId', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('400s without content', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ body: {} }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'content is required', code: 'VALIDATION_ERROR' })
  })

  it('400s for whitespace-only content', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ body: { content: '   ' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('400s for content over the length limit', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ body: { content: 'a'.repeat(10001) } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('404s for a nonexistent note', async () => {
    queryMock.mockImplementation(mockQueryImpl({ noteExists: false }))

    const res = mockRes()
    await handler(authedReq({ body: { content: 'edit' } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('403s when the requester is not the original author', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({ existingNote: { id: 'note1', task_id: 'task1', user_id: 'someone-else', created_at: 't1' } }),
    )

    const res = mockRes()
    await handler(authedReq({ body: { content: 'edit' } }), res)

    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('403s when a newer note already exists on the same task, even for the author', async () => {
    queryMock.mockImplementation(mockQueryImpl({ newerNotes: [{ id: 'note2' }] }))

    const res = mockRes()
    await handler(authedReq({ body: { content: 'edit' } }), res)

    expect(res.statusCode).toBe(403)
  })

  it('allows the author to edit their own latest note, populating edited_at and logging the diff', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        auditBefore: noteRow({ content: 'Sent draft', edited_at: null }),
        auditAfter: noteRow({ content: 'Sent final draft', edited_at: 't2' }),
        updatedNoteFull: noteRow({ content: 'Sent final draft', edited_at: 't2' }),
      }),
    )

    const res = mockRes()
    await handler(authedReq({ body: { content: 'Sent final draft' } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.content).toBe('Sent final draft')
    expect(res.body.edited_at).toBe('t2')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][0]).toBe('task_note')
    expect(auditCall[1][3]).toBe('updated')
    expect(JSON.parse(auditCall[1][4])).toEqual({ content: { from: 'Sent draft', to: 'Sent final draft' } })
    expect(auditCall[1][5]).toBe('task1') // task_id, from the note's own task_id column
  })

  it('does not log an audit entry when the edit is rejected', async () => {
    queryMock.mockImplementation(mockQueryImpl({ newerNotes: [{ id: 'note2' }] }))

    const res = mockRes()
    await handler(authedReq({ body: { content: 'edit' } }), res)

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeUndefined()
  })
})
