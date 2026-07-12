import { describe, expect, it } from 'vitest'
import { sendError } from './errors.js'

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
      return this
    },
  }
}

describe('sendError', () => {
  it.each([
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [405, 'METHOD_NOT_ALLOWED'],
    [409, 'CONFLICT'],
    [500, 'INTERNAL_ERROR'],
  ])('derives code %s -> %s from the status when none is given', (status, code) => {
    const res = mockRes()
    sendError(res, status, 'something went wrong')

    expect(res.statusCode).toBe(status)
    expect(res.body).toEqual({ error: 'something went wrong', code })
  })

  it('falls back to a generic ERROR code for an unmapped status', () => {
    const res = mockRes()
    sendError(res, 418, "I'm a teapot")

    expect(res.body).toEqual({ error: "I'm a teapot", code: 'ERROR' })
  })

  it('uses an explicit code when provided, overriding the status default', () => {
    const res = mockRes()
    sendError(res, 400, 'category is invalid', 'INVALID_CATEGORY')

    expect(res.body).toEqual({ error: 'category is invalid', code: 'INVALID_CATEGORY' })
  })

  it('returns the res object so callers can keep using `return sendError(...)`', () => {
    const res = mockRes()
    const returned = sendError(res, 404, 'not found')

    expect(returned).toBe(res)
  })
})
