import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../../../../lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

const verifyTokenMock = vi.fn()
vi.mock('@clerk/backend', () => ({
  verifyToken: (...args) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}))

const handler = (await import('./index.js')).default

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

// Distinguishes the joined NOTE_BASE_SELECT used two ways in this file — the
// list query (has ORDER BY) vs. POST's re-fetch-by-id of the just-created row
// (no ORDER BY) — from withAudit's own raw "SELECT * FROM task_notes" before/
// after snapshots, which don't use the alias `n` at all.
function mockQueryImpl(overrides = {}) {
  return (sql, params) => {
    if (sql.includes('FROM users WHERE clerk_user_id')) return { rows: [overrides.caller ?? CALLER_ROW] }
    if (sql.startsWith('SELECT id, deleted_at FROM tasks WHERE id')) {
      if (overrides.taskExists === false) return { rows: [] }
      return { rows: [{ id: params[0], deleted_at: overrides.taskDeletedAt ?? null }] }
    }
    if (sql.startsWith('SELECT count(*) FROM task_notes')) {
      return { rows: [{ count: String(overrides.total ?? 0) }] }
    }
    if (sql.startsWith('SELECT notes_preview_count FROM user_preferences')) {
      return { rows: overrides.previewCountRow === undefined ? [] : [overrides.previewCountRow] }
    }
    if (sql.includes('FROM task_notes n') && sql.includes('ORDER BY')) {
      return { rows: overrides.noteRows ?? [] }
    }
    if (sql.includes('FROM task_notes n') && sql.includes('WHERE n.id = $1')) {
      return { rows: [overrides.createdNoteFull ?? noteRow({ id: overrides.newNoteId ?? 'new-note-id' })] }
    }
    if (sql.startsWith('INSERT INTO task_notes')) {
      return { rows: [{ id: overrides.newNoteId ?? 'new-note-id' }] }
    }
    if (sql.startsWith('SELECT * FROM task_notes WHERE id')) {
      // Only POST triggers this (withAudit's single raw "after" fetch —
      // there's no "before" row yet on create), so no need to distinguish
      // before/after calls the way the PATCH tests do.
      return { rows: [overrides.auditAfter ?? noteRow()] }
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
  return { method: 'GET', query: { id: 'task1' }, headers: { authorization: 'Bearer good' }, ...overrides }
}

describe('GET /api/tasks/:id/notes', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('404s for a nonexistent task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskExists: false }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Task not found', code: 'NOT_FOUND' })
  })

  it('hides notes for a soft-deleted task from a non-admin (404)', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskDeletedAt: 't' }))

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

  it('preview mode uses the requesting user notes_preview_count preference', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        previewCountRow: { notes_preview_count: 5 },
        noteRows: [noteRow()],
        total: 12,
      }),
    )

    const res = mockRes()
    await handler(authedReq({ query: { id: 'task1', preview: 'true' } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ notes: [expect.objectContaining({ id: 'note1' })], total: 12, limit: 5, offset: 0 })
  })

  it('preview mode defaults to 2 when the user has no preferences row yet', async () => {
    queryMock.mockImplementation(mockQueryImpl({ noteRows: [noteRow()], total: 1 }))

    const res = mockRes()
    await handler(authedReq({ query: { id: 'task1', preview: 'true' } }), res)

    expect(res.body.limit).toBe(2)
  })

  it('paginated mode defaults limit/offset and returns total', async () => {
    queryMock.mockImplementation(mockQueryImpl({ noteRows: [noteRow(), noteRow({ id: 'note2' })], total: 14 }))

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.notes).toHaveLength(2)
    expect(res.body).toEqual(expect.objectContaining({ total: 14, limit: 25, offset: 0 }))
  })

  it('admin can view a soft-deleted task notes with include_deleted=true', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({ caller: { ...CALLER_ROW, role: 'admin' }, taskDeletedAt: 't', noteRows: [noteRow()] }),
    )

    const res = mockRes()
    await handler(authedReq({ query: { id: 'task1', include_deleted: 'true' } }), res)

    expect(res.statusCode).toBe(200)
  })
})

describe('POST /api/tasks/:id/notes', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('400s without content', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: {} }), res)

    expect(res.statusCode).toBe(400)
  })

  it('404s for a nonexistent task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskExists: false }))

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { content: 'hi' } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('404s for a soft-deleted task', async () => {
    queryMock.mockImplementation(mockQueryImpl({ taskDeletedAt: 't' }))

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { content: 'hi' } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('400s for whitespace-only content', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { content: '   ' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('400s for content over the length limit', async () => {
    queryMock.mockImplementation(mockQueryImpl())

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { content: 'a'.repeat(10001) } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('creates the note and logs a created audit entry', async () => {
    queryMock.mockImplementation(
      mockQueryImpl({
        newNoteId: 'new-note-id',
        createdNoteFull: noteRow({ id: 'new-note-id', content: 'Customer confirmed receipt' }),
        auditAfter: noteRow({ id: 'new-note-id', content: 'Customer confirmed receipt' }),
      }),
    )

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { content: 'Customer confirmed receipt' } }), res)

    expect(res.statusCode).toBe(201)
    expect(res.body.id).toBe('new-note-id')
    expect(res.body.content).toBe('Customer confirmed receipt')

    const auditCall = queryMock.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_log'))
    expect(auditCall).toBeDefined()
    expect(auditCall[1][0]).toBe('task_note')
    expect(auditCall[1][3]).toBe('created')
    expect(JSON.parse(auditCall[1][4])).toEqual({ content: { from: null, to: 'Customer confirmed receipt' } })
    expect(auditCall[1][5]).toBe('task1') // task_id, from the note's own task_id column
  })
})
