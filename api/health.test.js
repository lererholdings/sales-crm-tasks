import { describe, expect, it } from 'vitest'
import handler from './health.js'

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

describe('GET /api/health', () => {
  it('returns 200 { ok: true }', () => {
    const res = mockRes()
    handler({}, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
