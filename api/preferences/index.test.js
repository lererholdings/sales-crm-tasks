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
const DEFAULTS = {
  column_order: [],
  column_visibility: {},
  notes_preview_count: 2,
  accounts_column_order: [],
  accounts_column_visibility: {},
  theme: null,
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

describe('GET /api/preferences', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('returns defaults (including theme: null) when no preferences row exists yet', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({ rows: [] })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(DEFAULTS)
  })

  it('returns the stored preferences row when one exists, including theme', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [
          {
            column_order: ['status', 'priority'],
            column_visibility: { eta: false },
            notes_preview_count: 5,
            accounts_column_order: ['country', 'acv'],
            accounts_column_visibility: { acv: true },
            theme: 'dark',
          },
        ],
      })

    const res = mockRes()
    await handler(authedReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.theme).toBe('dark')
  })
})

describe('PATCH /api/preferences', () => {
  beforeEach(() => {
    queryMock.mockReset()
    verifyTokenMock.mockResolvedValue({ sub: 'clerk_caller' })
  })

  it('rejects an empty body', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: {} }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'No updatable fields provided', code: 'VALIDATION_ERROR' })
  })

  it('rejects a non-array column_order', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { column_order: 'status' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-object column_visibility', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { column_visibility: ['eta'] } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-array accounts_column_order', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { accounts_column_order: 'country' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects a non-object accounts_column_visibility', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { accounts_column_visibility: ['acv'] } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('rejects an invalid theme value', async () => {
    queryMock.mockResolvedValueOnce({ rows: [CALLER_ROW] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { theme: 'blue' } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('updates only column_order and leaves other fields alone (partial update)', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [
          {
            column_order: ['priority', 'status'],
            column_visibility: { eta: false },
            notes_preview_count: 3,
            accounts_column_order: [],
            accounts_column_visibility: {},
            theme: null,
          },
        ],
      })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { column_order: ['priority', 'status'] } }), res)

    expect(res.statusCode).toBe(200)
    const [sql, params] = queryMock.mock.calls[1]
    expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE')
    // booleans flagging which fields were actually provided in the request
    expect(params[7]).toBe(true) // column_order provided
    expect(params[8]).toBe(false) // column_visibility not provided
    expect(params[9]).toBe(false) // notes_preview_count not provided
    expect(params[10]).toBe(false) // accounts_column_order not provided
    expect(params[11]).toBe(false) // accounts_column_visibility not provided
    expect(params[12]).toBe(false) // theme not provided
    expect(res.body.column_order).toEqual(['priority', 'status'])
    expect(res.body.notes_preview_count).toBe(3)
  })

  it('updates notes_preview_count only', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [{ ...DEFAULTS, notes_preview_count: 4 }],
      })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { notes_preview_count: 4 } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.notes_preview_count).toBe(4)
  })

  it('updates accounts_column_order and accounts_column_visibility independently of the task columns', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({
        rows: [
          {
            column_order: [],
            column_visibility: {},
            notes_preview_count: 2,
            accounts_column_order: ['country', 'acv'],
            accounts_column_visibility: { acv: true },
            theme: null,
          },
        ],
      })

    const res = mockRes()
    await handler(
      authedReq({
        method: 'PATCH',
        body: { accounts_column_order: ['country', 'acv'], accounts_column_visibility: { acv: true } },
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    const [, params] = queryMock.mock.calls[1]
    expect(params[7]).toBe(false) // column_order not provided
    expect(params[8]).toBe(false) // column_visibility not provided
    expect(params[9]).toBe(false) // notes_preview_count not provided
    expect(params[10]).toBe(true) // accounts_column_order provided
    expect(params[11]).toBe(true) // accounts_column_visibility provided
    expect(params[12]).toBe(false) // theme not provided
    expect(res.body.accounts_column_order).toEqual(['country', 'acv'])
    expect(res.body.accounts_column_visibility).toEqual({ acv: true })
  })

  it('updates theme independently of every other field', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [CALLER_ROW] })
      .mockResolvedValueOnce({ rows: [{ ...DEFAULTS, theme: 'dark' }] })

    const res = mockRes()
    await handler(authedReq({ method: 'PATCH', body: { theme: 'dark' } }), res)

    expect(res.statusCode).toBe(200)
    const [, params] = queryMock.mock.calls[1]
    expect(params[6]).toBe('dark') // theme value
    expect(params[7]).toBe(false) // column_order not provided
    expect(params[12]).toBe(true) // theme provided
    expect(res.body.theme).toBe('dark')
  })
})
