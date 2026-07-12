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

const CALLER_ROW = { id: 'caller-id', role: 'member', display_name: 'Caller', email: 'c@x.com' }

function authedReq(overrides = {}) {
  return {
    method: 'GET',
    query: {},
    headers: { authorization: 'Bearer good' },
    ...overrides,
  }
}

describe('GET /api/accounts', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('lists accounts without acv by default', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'a1',
          name: 'Acme',
          country: 'AU',
          sfdc_account_url: null,
          acv: '120000.00',
          updated_at: 't',
          updated_by_id: 'caller-id',
          updated_by_name: 'Caller',
        },
      ],
    })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body[0].acv).toBeUndefined()
    expect(res.body[0].name).toBe('Acme')
    expect(res.body[0].last_updated_by).toEqual({ id: 'caller-id', display_name: 'Caller' })
  })

  it('includes acv when ?include=acv is passed', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'a1',
          name: 'Acme',
          country: 'AU',
          sfdc_account_url: null,
          acv: '120000.00',
          updated_at: 't',
          updated_by_id: null,
          updated_by_name: null,
        },
      ],
    })

    const res = mockRes()
    await handler(authedReq({ query: { include: 'acv' } }), res)

    expect(res.body[0].acv).toBe(120000)
    expect(res.body[0].last_updated_by).toBeNull()
  })

  it('passes the search param through to the query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ query: { search: 'Acme' } }), res)

    expect(res.statusCode).toBe(200)
    const [, params] = queryMock.mock.calls[1]
    expect(params[0]).toBe('Acme')
  })

  it('filters by country', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ query: { country: 'Australia' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls[1]
    expect(sql).toContain("a.country ILIKE '%' || $2 || '%'")
    expect(params).toEqual([null, 'Australia'])
  })

  it('sorts by an allowlisted column and direction, with archived always last', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ query: { sort_by: 'acv', sort_dir: 'desc' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql] = queryMock.mock.calls[1]
    expect(sql).toContain('ORDER BY (a.deleted_at IS NOT NULL), a.acv DESC')
  })

  it('falls back to the default sort column for an unrecognized sort_by (never interpolates raw input)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq({ query: { sort_by: 'DROP TABLE accounts;--' } }), res)

    expect(res.statusCode).toBe(200)
    const [sql] = queryMock.mock.calls[1]
    expect(sql).toContain('ORDER BY (a.deleted_at IS NOT NULL), a.name ASC')
  })
})

describe('POST /api/accounts', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('rejects when name or country is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { name: 'Acme' } }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'name and country are required', code: 'VALIDATION_ERROR' })
  })

  it('rejects a name over the length limit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { name: 'a'.repeat(301), country: 'AU' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a country over the length limit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { name: 'Acme', country: 'a'.repeat(101) } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-http(s) sfdc_account_url', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(
      authedReq({
        method: 'POST',
        body: { name: 'Acme', country: 'AU', sfdc_account_url: 'javascript:alert(1)' },
      }),
      res,
    )

    expect(res.statusCode).toBe(400)
  })

  it('creates an account and returns it with acv', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({
      rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '120000.00', updated_at: 't' }],
    })

    const res = mockRes()
    await handler(authedReq({ method: 'POST', body: { name: 'Acme', country: 'AU', acv: 120000 } }), res)

    expect(res.statusCode).toBe(201)
    expect(res.body.acv).toBe(120000)
    expect(res.body.last_updated_by).toEqual({ id: 'caller-id', display_name: 'Caller' })
  })

  it('writes an audit_log entry with action "created" and { from: null, to } for each field', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] }).mockResolvedValueOnce({
      rows: [{ id: 'a1', name: 'Acme', country: 'AU', sfdc_account_url: null, acv: '120000.00', updated_at: 't' }],
    })

    await handler(authedReq({ method: 'POST', body: { name: 'Acme', country: 'AU', acv: 120000 } }), mockRes())

    const auditCall = queryMock.mock.calls[2]
    expect(auditCall[0]).toContain('INSERT INTO audit_log')
    const [entityType, entityId, userId, action, changedFields] = auditCall[1]
    expect(entityType).toBe('account')
    expect(entityId).toBe('a1')
    expect(userId).toBe('caller-id')
    expect(action).toBe('created')
    expect(JSON.parse(changedFields)).toEqual({
      name: { from: null, to: 'Acme' },
      country: { from: null, to: 'AU' },
      acv: { from: null, to: 120000 },
    })
  })
})
