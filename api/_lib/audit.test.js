import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('./db.js', () => ({ query: (...args) => queryMock(...args) }))

const { logFieldChanges } = await import('./audit.js')

describe('logFieldChanges', () => {
  beforeEach(() => {
    queryMock.mockReset()
  })

  it('writes one row with the { field: { from, to } } shape', async () => {
    await logFieldChanges('account', 'acc1', 'user1', { acv: { from: 50000, to: 120000 } })

    expect(queryMock).toHaveBeenCalledTimes(1)
    const [sql, params] = queryMock.mock.calls[0]
    expect(sql).toContain('INSERT INTO audit_log')
    expect(params[0]).toBe('account')
    expect(params[1]).toBe('acc1')
    expect(params[2]).toBe('user1')
    expect(JSON.parse(params[3])).toEqual({ acv: { from: 50000, to: 120000 } })
  })

  it('does nothing when there are no changes', async () => {
    await logFieldChanges('account', 'acc1', 'user1', {})
    expect(queryMock).not.toHaveBeenCalled()
  })
})
