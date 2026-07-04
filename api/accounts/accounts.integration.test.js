import { afterAll, describe, expect, it } from 'vitest'
import { query } from '../../lib/db.js'
import listCreateHandler from './index.js'
import singleHandler from './[id].js'

// Same pattern as api/users/users.integration.test.js — real dev DB, real
// handlers, authenticated via the test auth bypass (see lib/auth.js).
const hasEnv = Boolean(process.env.DATABASE_URL) && Boolean(process.env.TEST_AUTH_BYPASS_SECRET)
const bypassSecret = process.env.TEST_AUTH_BYPASS_SECRET
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const testClerkId = `test_ci_${runId}_accounts`
const createdAccountIds = []

function bypassReq(overrides = {}) {
  return {
    headers: {
      'x-test-bypass-secret': bypassSecret,
      'x-test-clerk-user-id': testClerkId,
      'x-test-email': `${testClerkId}@test.invalid`,
    },
    query: {},
    ...overrides,
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

describe.skipIf(!hasEnv)('accounts API integration (real dev DB)', () => {
  afterAll(async () => {
    if (createdAccountIds.length > 0) {
      await query('DELETE FROM audit_log WHERE entity_id = ANY($1)', [createdAccountIds])
      await query('DELETE FROM accounts WHERE id = ANY($1)', [createdAccountIds])
    }
    await query('DELETE FROM users WHERE clerk_user_id = $1', [testClerkId])
  })

  it('creates an account, then lists and finds it via search', async () => {
    const name = `Test CI Account ${runId}`
    const createRes = mockRes()
    await listCreateHandler(
      bypassReq({ method: 'POST', body: { name, country: 'Australia', acv: 50000 } }),
      createRes,
    )
    expect(createRes.statusCode).toBe(201)
    createdAccountIds.push(createRes.body.id)

    const listRes = mockRes()
    await listCreateHandler(bypassReq({ method: 'GET', query: { search: name } }), listRes)
    expect(listRes.statusCode).toBe(200)
    expect(listRes.body.some((a) => a.id === createRes.body.id)).toBe(true)
  })

  it('writes a real audit_log "created" row on POST', async () => {
    const name = `Test CI Account Created ${runId}`
    const createRes = mockRes()
    await listCreateHandler(
      bypassReq({ method: 'POST', body: { name, country: 'Australia', acv: 30000 } }),
      createRes,
    )
    const accountId = createRes.body.id
    createdAccountIds.push(accountId)

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'created'",
      [accountId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].changed_fields).toEqual({
      name: { from: null, to: name },
      country: { from: null, to: 'Australia' },
      acv: { from: null, to: 30000 },
    })
  })

  it('gets a single account with acv', async () => {
    const name = `Test CI Account Single ${runId}`
    const createRes = mockRes()
    await listCreateHandler(
      bypassReq({ method: 'POST', body: { name, country: 'Australia', acv: 75000 } }),
      createRes,
    )
    createdAccountIds.push(createRes.body.id)

    const getRes = mockRes()
    await singleHandler(bypassReq({ method: 'GET', query: { id: createRes.body.id } }), getRes)
    expect(getRes.statusCode).toBe(200)
    expect(getRes.body.acv).toBe(75000)
  })

  it('patches acv and writes a real audit_log row with the {from, to} diff', async () => {
    const name = `Test CI Account Patch ${runId}`
    const createRes = mockRes()
    await listCreateHandler(
      bypassReq({ method: 'POST', body: { name, country: 'Australia', acv: 10000 } }),
      createRes,
    )
    const accountId = createRes.body.id
    createdAccountIds.push(accountId)

    const patchRes = mockRes()
    await singleHandler(bypassReq({ method: 'PATCH', query: { id: accountId }, body: { acv: 99000 } }), patchRes)
    expect(patchRes.statusCode).toBe(200)
    expect(patchRes.body.acv).toBe(99000)

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'updated'",
      [accountId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].changed_fields).toEqual({ acv: { from: 10000, to: 99000 } })
  })
})
