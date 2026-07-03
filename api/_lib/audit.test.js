import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
vi.mock('./db.js', () => ({ query: (...args) => queryMock(...args) }))

const { logFieldChanges, toCreatedChanges } = await import('./audit.js')

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
