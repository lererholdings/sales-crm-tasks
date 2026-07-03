import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('../_lib/db.js', () => ({ query: (...args) => queryMock(...args) }))

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
})
