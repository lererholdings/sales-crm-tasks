import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

describe.skipIf(!hasEnv)('account archive integration (real dev DB)', () => {
  const memberClerkId = `test_ci_${runId}_archive_member`
  const adminClerkId = `test_ci_${runId}_archive_admin`
  let activeTaskTypeId = null
  const createdArchiveTaskIds = []
  const createdArchiveAccountIds = []

  function bypassReqAs(clerkId, overrides = {}) {
    return {
      headers: {
        'x-test-bypass-secret': bypassSecret,
        'x-test-clerk-user-id': clerkId,
        'x-test-email': `${clerkId}@test.invalid`,
      },
      query: {},
      ...overrides,
    }
  }

  async function createTestAccount(name) {
    const createRes = mockRes()
    await listCreateHandler(
      bypassReqAs(adminClerkId, { method: 'POST', body: { name, country: 'Australia' } }),
      createRes,
    )
    createdArchiveAccountIds.push(createRes.body.id)
    return createRes.body.id
  }

  async function insertTask(accountId, status) {
    const { rows: adminUserRows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [adminClerkId])
    const assigneeId = adminUserRows[0].id
    const { rows } = await query(
      `INSERT INTO tasks (task_name, account_id, task_type_id, assignee_id, status, last_updated_by)
       VALUES ($1, $2, $3, $4, $5, $4) RETURNING id`,
      [`Test CI Archive Task ${runId}`, accountId, activeTaskTypeId, assigneeId, status],
    )
    createdArchiveTaskIds.push(rows[0].id)
  }

  beforeAll(async () => {
    const { rows } = await query('SELECT id FROM task_types WHERE active = true LIMIT 1')
    activeTaskTypeId = rows[0]?.id
    if (!activeTaskTypeId) throw new Error('No active task_types row found in dev DB — cannot run this suite')

    await listCreateHandler(bypassReqAs(adminClerkId, { method: 'GET' }), mockRes())
    await query('UPDATE users SET role = $1 WHERE clerk_user_id = $2', ['admin', adminClerkId])
    await listCreateHandler(bypassReqAs(memberClerkId, { method: 'GET' }), mockRes())
  })

  afterAll(async () => {
    if (createdArchiveTaskIds.length > 0) await query('DELETE FROM tasks WHERE id = ANY($1)', [createdArchiveTaskIds])
    if (createdArchiveAccountIds.length > 0) {
      await query('DELETE FROM audit_log WHERE entity_id = ANY($1)', [createdArchiveAccountIds])
      await query('DELETE FROM accounts WHERE id = ANY($1)', [createdArchiveAccountIds])
    }
    await query('DELETE FROM users WHERE clerk_user_id = ANY($1)', [[memberClerkId, adminClerkId]])
  })

  it('403s a non-admin trying to archive', async () => {
    const accountId = await createTestAccount(`Test CI Archive Member ${runId}`)

    const res = mockRes()
    await singleHandler(bypassReqAs(memberClerkId, { method: 'DELETE', query: { id: accountId } }), res)

    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('409s when the account has an active (non-done) task', async () => {
    const accountId = await createTestAccount(`Test CI Archive Active ${runId}`)
    await insertTask(accountId, 'in_progress')

    const res = mockRes()
    await singleHandler(bypassReqAs(adminClerkId, { method: 'DELETE', query: { id: accountId } }), res)

    expect(res.statusCode).toBe(409)
    expect(res.body.code).toBe('CONFLICT')
  })

  it('archives when all tasks are done, writes an audit_log "deleted" entry, and still appears in the list', async () => {
    const accountId = await createTestAccount(`Test CI Archive Done ${runId}`)
    await insertTask(accountId, 'done')

    const res = mockRes()
    await singleHandler(bypassReqAs(adminClerkId, { method: 'DELETE', query: { id: accountId } }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.deleted_at).not.toBeNull()

    const { rows: auditRows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'account' AND entity_id = $1 AND action = 'deleted'",
      [accountId],
    )
    expect(auditRows).toHaveLength(1)

    const listRes = mockRes()
    await listCreateHandler(bypassReqAs(adminClerkId, { method: 'GET' }), listRes)
    const listed = listRes.body.find((a) => a.id === accountId)
    expect(listed).toBeDefined()
    expect(listed.deleted_at).not.toBeNull()
  })

  it('400s when archiving an already-archived account', async () => {
    const accountId = await createTestAccount(`Test CI Archive Twice ${runId}`)

    await singleHandler(bypassReqAs(adminClerkId, { method: 'DELETE', query: { id: accountId } }), mockRes())

    const res = mockRes()
    await singleHandler(bypassReqAs(adminClerkId, { method: 'DELETE', query: { id: accountId } }), res)

    expect(res.statusCode).toBe(400)
  })
})
