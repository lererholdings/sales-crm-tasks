import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('./db.js', () => ({ query: (...args) => queryMock(...args) }))

const { logFieldChanges, toCreatedChanges, withAudit } = await import('./audit.js')

describe('logFieldChanges', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('writes one row with the { field: { from, to } } shape', async () => {
    await logFieldChanges('account', 'acc1', 'user1', 'updated', { acv: { from: 50000, to: 120000 } })

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO audit_log')
    expect(params[0]).toBe('account')
    expect(params[1]).toBe('acc1')
    expect(params[2]).toBe('user1')
    expect(params[3]).toBe('updated')
    expect(JSON.parse(params[4])).toEqual({ acv: { from: 50000, to: 120000 } })
  })

  it('does nothing when there are no changes', async () => {
    await logFieldChanges('account', 'acc1', 'user1', 'updated', {})
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('supports the created action with a distinct action value', async () => {
    await logFieldChanges('account', 'acc1', 'user1', 'created', { name: { from: null, to: 'Acme' } })

    const [, params] = queryMock.mock.calls[0]
    expect(params[3]).toBe('created')
  })
})

describe('toCreatedChanges', () => {
  it('wraps each provided field as { from: null, to: value }', () => {
    expect(toCreatedChanges({ name: 'Acme', country: 'AU' })).toEqual({
      name: { from: null, to: 'Acme' },
      country: { from: null, to: 'AU' },
    })
  })

  it('skips null and undefined fields', () => {
    expect(toCreatedChanges({ name: 'Acme', acv: null, sfdc_account_url: undefined })).toEqual({
      name: { from: null, to: 'Acme' },
    })
  })
})

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

describe('withAudit', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('logs a created entry after a successful POST', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 't1', task_name: 'RFP', status: 'backlog' }] }) // after-fetch
      .mockResolvedValueOnce({}) // audit insert

    const innerHandler = vi.fn(async (req, res) => {
      res.status(201).json({ id: 't1', task_name: 'RFP' })
    })
    const wrapped = withAudit({ table: 'tasks', entityType: 'task', fields: ['task_name', 'status'] }, innerHandler)

    const res = mockRes()
    await wrapped({ method: 'POST', query: {} }, res, { id: 'user1' })

    expect(res.statusCode).toBe(201)
    expect(queryMock).toHaveBeenCalledTimes(2)
    const auditCall = queryMock.mock.calls[1]
    expect(auditCall[1][3]).toBe('created')
    expect(JSON.parse(auditCall[1][4])).toEqual({
      task_name: { from: null, to: 'RFP' },
      status: { from: null, to: 'backlog' },
    })
  })

  it('logs an updated entry with the before/after diff on a successful PATCH', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 't1', task_name: 'Old name', status: 'backlog' }] }) // before-fetch
      .mockResolvedValueOnce({ rows: [{ id: 't1', task_name: 'New name', status: 'backlog' }] }) // after-fetch
      .mockResolvedValueOnce({}) // audit insert

    const innerHandler = vi.fn(async (req, res) => {
      res.status(200).json({ id: 't1', task_name: 'New name' })
    })
    const wrapped = withAudit({ table: 'tasks', entityType: 'task', fields: ['task_name', 'status'] }, innerHandler)

    const res = mockRes()
    await wrapped({ method: 'PATCH', query: { id: 't1' } }, res, { id: 'user1' })

    expect(queryMock).toHaveBeenCalledTimes(3)
    const auditCall = queryMock.mock.calls[2]
    expect(auditCall[1][3]).toBe('updated')
    expect(JSON.parse(auditCall[1][4])).toEqual({
      task_name: { from: 'Old name', to: 'New name' },
    })
  })

  it('logs a deleted entry via the same diff path on a successful DELETE', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 't1', deleted_at: null, deleted_by: null }] }) // before-fetch
      .mockResolvedValueOnce({
        rows: [{ id: 't1', deleted_at: '2026-07-05T00:00:00Z', deleted_by: 'user1' }],
      }) // after-fetch
      .mockResolvedValueOnce({}) // audit insert

    const innerHandler = vi.fn(async (req, res) => {
      res.status(200).json({ deleted: true })
    })
    const wrapped = withAudit(
      { table: 'tasks', entityType: 'task', fields: ['deleted_at', 'deleted_by'] },
      innerHandler,
    )

    const res = mockRes()
    await wrapped({ method: 'DELETE', query: { id: 't1' } }, res, { id: 'user1' })

    const auditCall = queryMock.mock.calls[2]
    expect(auditCall[1][3]).toBe('deleted')
    expect(JSON.parse(auditCall[1][4])).toEqual({
      deleted_at: { from: null, to: '2026-07-05T00:00:00Z' },
      deleted_by: { from: null, to: 'user1' },
    })
  })

  it('does not log anything when the handler responds with a non-2xx status', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 't1', task_name: 'Old' }] }) // before-fetch

    const innerHandler = vi.fn(async (req, res) => {
      res.status(400).json({ error: 'bad request' })
    })
    const wrapped = withAudit({ table: 'tasks', entityType: 'task', fields: ['task_name'] }, innerHandler)

    const res = mockRes()
    await wrapped({ method: 'PATCH', query: { id: 't1' } }, res, { id: 'user1' })

    expect(queryMock).toHaveBeenCalledTimes(1)
  })
})
