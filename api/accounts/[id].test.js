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

const CALLER_ROW = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

function authedReq(overrides = {}) {
  return {
    method: 'GET',
    query: { id: 'a1' },
    headers: { authorization: 'Bearer good' },
    ...overrides,
  }
}

describe('GET /api/accounts/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('returns the account with acv', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'a1',
          name: 'Acme',
          country: 'AU',
          sfdc_account_url: null,
          acv: '50000.00',
          updated_at: 't',
          updated_by_id: null,
          updated_by_name: null,
        },
      ],
    })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.acv).toBe(50000)
  })

  it('404s when the account does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/accounts/:id', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('400s when no updatable fields are provided', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: {} }), res)

    expect(res.statusCode).toBe(400)
  })

  it('404s when the account does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { acv: 1000 } }), res)

    expect(res.statusCode).toBe(404)
  })

  it('updates acv and writes an audit_log entry with the {from, to} diff', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '50000.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '120000.00', updated_at: 't' }],
      })
      .mockResolvedValueOnce({})

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { acv: 120000 } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.acv).toBe(120000)

    const auditCall = queryMock.mock.calls[3]
    expect(auditCall[0]).toContain('INSERT INTO audit_log')
    expect(auditCall[1][3]).toBe('updated')
    expect(JSON.parse(auditCall[1][4])).toEqual({ acv: { from: 50000, to: 120000 } })
    expect(auditCall[1][6]).toBe('a1') // account_id
  })

  it('does not log a change when the new value equals the current value', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '50000.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '50000.00', updated_at: 't' }],
      })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { acv: 50000 } }), res)

    expect(res.statusCode).toBe(200)
    expect(queryMock).toHaveBeenCalledTimes(3)
  })
})

describe('DELETE /api/accounts/:id (archive)', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('403s for a non-admin', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(403)
  })

  it('404s when the account does not exist', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ ...CALLER_ROW, role: 'admin' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(404)
  })

  it('400s when the account is already archived', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ ...CALLER_ROW, role: 'admin' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1', deleted_at: 'already' }] })

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(400)
  })

  it('409s when the account has an active (non-done, non-deleted) task', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ ...CALLER_ROW, role: 'admin' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1', deleted_at: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'active-task' }] })

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(409)
  })

  it('archives the account and logs a "deleted" audit entry when there are no active tasks', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ ...CALLER_ROW, role: 'admin' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a1', deleted_at: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '50000.00', updated_at: 't', deleted_at: 'now' },
        ],
      })
      .mockResolvedValueOnce({})

    const res = mockRes()
    await handler(authedReq({ method: 'DELETE' }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.deleted_at).toBe('now')

    const auditCall = queryMock.mock.calls[4]
    expect(auditCall[0]).toContain('INSERT INTO audit_log')
    expect(auditCall[1][3]).toBe('deleted')
    expect(JSON.parse(auditCall[1][4])).toEqual({ deleted_at: { from: null, to: 'now' } })
    expect(auditCall[1][6]).toBe('a1') // account_id
  })
})
