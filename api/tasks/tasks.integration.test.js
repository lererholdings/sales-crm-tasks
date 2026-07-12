import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { query } from '../../lib/db.js'
import listCreateHandler from './index.js'
import singleHandler from './[id]/index.js'
import notesHandler from './[id]/notes/index.js'
import noteHandler from './[id]/notes/[noteId].js'

// Same pattern as api/accounts/accounts.integration.test.js — real dev DB,
// real handlers, authenticated via the test bypass.
const hasEnv = Boolean(process.env.DATABASE_URL) && Boolean(process.env.TEST_AUTH_BYPASS_SECRET)
const bypassSecret = process.env.TEST_AUTH_BYPASS_SECRET
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const testClerkId = `test_ci_${runId}_tasks`
const createdTaskIds = []
let activeTaskTypeId = null

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

describe.skipIf(!hasEnv)('tasks API integration (real dev DB)', () => {
  beforeAll(async () => {
    const { rows } = await query('SELECT id FROM task_types WHERE active = true LIMIT 1')
    activeTaskTypeId = rows[0]?.id
    if (!activeTaskTypeId) throw new Error('No active task_types row found in dev DB — cannot run this suite')
  })

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await query('DELETE FROM audit_log WHERE entity_id = ANY($1)', [createdTaskIds])
      await query('DELETE FROM task_notes WHERE task_id = ANY($1)', [createdTaskIds])
      await query('DELETE FROM tasks WHERE id = ANY($1)', [createdTaskIds])
    }
    await query('DELETE FROM users WHERE clerk_user_id = $1', [testClerkId])
  })

  async function createTestTask(overrides = {}) {
    const createRes = mockRes()
    // The bypass user auto-provisions on its first call; use its own id as
    // assignee since it's a guaranteed-real user row for this test run.
    const listRes = mockRes()
    await listCreateHandler(bypassReq({ method: 'GET' }), listRes)
    const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [testClerkId])
    const assigneeId = rows[0].id

    await listCreateHandler(
      bypassReq({
        method: 'POST',
        body: {
          task_name: `Test CI Task ${runId}`,
          assignee_id: assigneeId,
          task_type_id: activeTaskTypeId,
          ...overrides,
        },
      }),
      createRes,
    )
    if (createRes.statusCode === 201) createdTaskIds.push(createRes.body.id)
    return createRes
  }

  it('creates a task and writes a real audit_log "created" entry', async () => {
    const createRes = await createTestTask()
    expect(createRes.statusCode).toBe(201)

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'task' AND entity_id = $1 AND action = 'created'",
      [createRes.body.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].changed_fields.task_name).toEqual({ from: null, to: createRes.body.task_name })
  })

  it('the created task appears in the list, excluding soft-deleted by default', async () => {
    const createRes = await createTestTask({ status: 'in_progress' })

    const listRes = mockRes()
    await listCreateHandler(bypassReq({ method: 'GET', query: { status: 'in_progress' } }), listRes)

    expect(listRes.statusCode).toBe(200)
    expect(listRes.body.some((t) => t.id === createRes.body.id)).toBe(true)
  })

  it('gets a single task with paginated notes', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    await query(
      `INSERT INTO task_notes (task_id, user_id, content) VALUES ($1, $2, 'first note'), ($1, $2, 'second note')`,
      [taskId, createRes.body.assignee.id],
    )

    const getRes = mockRes()
    await singleHandler(bypassReq({ method: 'GET', query: { id: taskId } }), getRes)

    expect(getRes.statusCode).toBe(200)
    expect(getRes.body.notes_total).toBe(2)
    expect(getRes.body.notes).toHaveLength(2)
  })

  it('patches a task and writes a real audit_log "updated" entry with the diff', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    const patchRes = mockRes()
    await singleHandler(
      bypassReq({ method: 'PATCH', query: { id: taskId }, body: { status: 'waiting', priority: 'critical' } }),
      patchRes,
    )

    expect(patchRes.statusCode).toBe(200)
    expect(patchRes.body.status).toBe('waiting')

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'task' AND entity_id = $1 AND action = 'updated'",
      [taskId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].changed_fields).toEqual({
      status: { from: 'backlog', to: 'waiting' },
      priority: { from: 'medium', to: 'critical' },
    })
  })

  it('deletes a task, cascades notes, and hides it from the default (non-admin) list', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    await query(`INSERT INTO task_notes (task_id, user_id, content) VALUES ($1, $2, 'a note')`, [
      taskId,
      createRes.body.assignee.id,
    ])

    const deleteRes = mockRes()
    await singleHandler(bypassReq({ method: 'DELETE', query: { id: taskId } }), deleteRes)

    expect(deleteRes.statusCode).toBe(200)
    expect(deleteRes.body).toEqual({ deleted: true, notes_deleted: 1 })

    const { rows: auditRows } = await query(
      "SELECT action FROM audit_log WHERE entity_type = 'task' AND entity_id = $1 AND action = 'deleted'",
      [taskId],
    )
    expect(auditRows).toHaveLength(2)

    const getRes = mockRes()
    await singleHandler(bypassReq({ method: 'GET', query: { id: taskId } }), getRes)
    expect(getRes.statusCode).toBe(404)
  })
})

describe.skipIf(!hasEnv)('task notes API integration (real dev DB)', () => {
  beforeAll(async () => {
    const { rows } = await query('SELECT id FROM task_types WHERE active = true LIMIT 1')
    activeTaskTypeId = rows[0]?.id
    if (!activeTaskTypeId) throw new Error('No active task_types row found in dev DB — cannot run this suite')
  })

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await query('DELETE FROM audit_log WHERE entity_id = ANY($1)', [createdTaskIds])
      await query('DELETE FROM task_notes WHERE task_id = ANY($1)', [createdTaskIds])
      await query('DELETE FROM tasks WHERE id = ANY($1)', [createdTaskIds])
    }
    await query('DELETE FROM users WHERE clerk_user_id = $1', [testClerkId])
  })

  async function createTestTask(overrides = {}) {
    const listRes = mockRes()
    await listCreateHandler(bypassReq({ method: 'GET' }), listRes)
    const { rows } = await query('SELECT id FROM users WHERE clerk_user_id = $1', [testClerkId])
    const assigneeId = rows[0].id

    const createRes = mockRes()
    await listCreateHandler(
      bypassReq({
        method: 'POST',
        body: {
          task_name: `Test CI Task ${runId}`,
          assignee_id: assigneeId,
          task_type_id: activeTaskTypeId,
          ...overrides,
        },
      }),
      createRes,
    )
    if (createRes.statusCode === 201) createdTaskIds.push(createRes.body.id)
    return createRes
  }

  it('adds a note and writes a real audit_log "created" entry', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    const addRes = mockRes()
    await notesHandler(
      bypassReq({ method: 'POST', query: { id: taskId }, body: { content: 'Sent initial draft' } }),
      addRes,
    )

    expect(addRes.statusCode).toBe(201)
    expect(addRes.body.content).toBe('Sent initial draft')

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'task_note' AND entity_id = $1 AND action = 'created'",
      [addRes.body.id],
    )
    expect(rows).toHaveLength(1)
  })

  it('lists notes in paginated mode with a total count', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    for (const content of ['first', 'second', 'third']) {
      await notesHandler(bypassReq({ method: 'POST', query: { id: taskId }, body: { content } }), mockRes())
    }

    const listRes = mockRes()
    await notesHandler(bypassReq({ method: 'GET', query: { id: taskId } }), listRes)

    expect(listRes.statusCode).toBe(200)
    expect(listRes.body.total).toBe(3)
    expect(listRes.body.notes).toHaveLength(3)
  })

  it('preview mode returns only the default preview count (no preferences row yet)', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    for (const content of ['first', 'second', 'third']) {
      await notesHandler(bypassReq({ method: 'POST', query: { id: taskId }, body: { content } }), mockRes())
    }

    const previewRes = mockRes()
    await notesHandler(bypassReq({ method: 'GET', query: { id: taskId, preview: 'true' } }), previewRes)

    expect(previewRes.statusCode).toBe(200)
    expect(previewRes.body.total).toBe(3)
    expect(previewRes.body.notes).toHaveLength(2)
  })

  it('allows the author to edit their own latest note, populating edited_at', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    const addRes = mockRes()
    await notesHandler(bypassReq({ method: 'POST', query: { id: taskId }, body: { content: 'original' } }), addRes)
    const noteId = addRes.body.id

    const editRes = mockRes()
    await noteHandler(
      bypassReq({ method: 'PATCH', query: { id: taskId, noteId }, body: { content: 'edited' } }),
      editRes,
    )

    expect(editRes.statusCode).toBe(200)
    expect(editRes.body.content).toBe('edited')
    expect(editRes.body.edited_at).not.toBeNull()

    const { rows } = await query(
      "SELECT changed_fields FROM audit_log WHERE entity_type = 'task_note' AND entity_id = $1 AND action = 'updated'",
      [noteId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].changed_fields).toEqual({ content: { from: 'original', to: 'edited' } })
  })

  it('blocks editing a note once a newer note exists on the same task', async () => {
    const createRes = await createTestTask()
    const taskId = createRes.body.id

    const firstRes = mockRes()
    await notesHandler(bypassReq({ method: 'POST', query: { id: taskId }, body: { content: 'first' } }), firstRes)
    const firstNoteId = firstRes.body.id

    await notesHandler(bypassReq({ method: 'POST', query: { id: taskId }, body: { content: 'second' } }), mockRes())

    const editRes = mockRes()
    await noteHandler(
      bypassReq({ method: 'PATCH', query: { id: taskId, noteId: firstNoteId }, body: { content: 'too late' } }),
      editRes,
    )

    expect(editRes.statusCode).toBe(403)
    expect(editRes.body.code).toBe('FORBIDDEN')
  })
})
