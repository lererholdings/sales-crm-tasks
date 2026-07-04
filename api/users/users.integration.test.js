import { afterAll, describe, expect, it } from 'vitest'
import { query } from '../../lib/db.js'
import getUsersHandler from './index.js'
import patchUserHandler from './[id].js'

// Hits the real dev database and the real handlers end to end via the test
// auth bypass — see lib/auth.js and design.md section 12 ("Test auth
// bypass"). Skipped entirely if the required secrets aren't present, so a
// plain `npm test` (or a contributor without dev DB access) never trips
// over these; run explicitly via `npm run test:integration`.
const hasEnv = Boolean(process.env.DATABASE_URL) && Boolean(process.env.TEST_AUTH_BYPASS_SECRET)
const bypassSecret = process.env.TEST_AUTH_BYPASS_SECRET
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const createdClerkIds = []

function bypassReq(clerkUserId, overrides = {}) {
  createdClerkIds.push(clerkUserId)
  return {
    method: 'GET',
    query: {},
    headers: {
      'x-test-bypass-secret': bypassSecret,
      'x-test-clerk-user-id': clerkUserId,
      'x-test-email': `${clerkUserId}@test.invalid`,
      ...overrides.headers,
    },
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

describe.skipIf(!hasEnv)('users API integration (real dev DB)', () => {
  afterAll(async () => {
    if (createdClerkIds.length === 0) return
    await query('DELETE FROM users WHERE clerk_user_id = ANY($1)', [createdClerkIds])
  })

  it('auto-provisions on first request and appears in GET /api/users', async () => {
    const clerkUserId = `test_ci_${runId}_member`
    const res = mockRes()

    await getUsersHandler(bypassReq(clerkUserId), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.some((u) => u.email === `${clerkUserId}@test.invalid`)).toBe(true)
  })

  it('does not duplicate the row on a second request', async () => {
    const clerkUserId = `test_ci_${runId}_dup`
    await getUsersHandler(bypassReq(clerkUserId), mockRes())
    await getUsersHandler(bypassReq(clerkUserId), mockRes())

    const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [clerkUserId])
    expect(rows).toHaveLength(1)
  })

  it('a member (real default role) cannot PATCH another user\'s role', async () => {
    const memberClerkId = `test_ci_${runId}_patcher_member`
    const targetClerkId = `test_ci_${runId}_patch_target`

    await getUsersHandler(bypassReq(targetClerkId), mockRes())
    const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [targetClerkId])
    const targetId = rows[0].id

    const res = mockRes()
    await patchUserHandler(
      bypassReq(memberClerkId, { method: 'PATCH', query: { id: targetId }, body: { role: 'admin' } }),
      res,
    )

    expect(res.statusCode).toBe(403)
  })

  it('an admin can PATCH another user\'s role', async () => {
    const adminClerkId = `test_ci_${runId}_patcher_admin`
    const targetClerkId = `test_ci_${runId}_patch_target2`

    await getUsersHandler(bypassReq(adminClerkId), mockRes())
    await query('UPDATE users SET role = $1 WHERE clerk_user_id = $2', ['admin', adminClerkId])

    await getUsersHandler(bypassReq(targetClerkId), mockRes())
    const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [targetClerkId])
    const targetId = rows[0].id

    const res = mockRes()
    await patchUserHandler(
      bypassReq(adminClerkId, { method: 'PATCH', query: { id: targetId }, body: { role: 'admin' } }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.role).toBe('admin')
  })
})
