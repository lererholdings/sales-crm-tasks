import { withAuth } from '../../lib/auth.js'
import { withAudit, logFieldChanges } from '../../lib/audit.js'
import { query } from '../../lib/db.js'
import { TASK_AUDIT_FIELDS, TASK_BASE_SELECT, toTask } from '../../lib/tasks.js'

async function fetchPaginatedNotes(taskId, limit, offset) {
  const { rows } = await query(
    `SELECT n.id, n.content, n.created_at, n.edited_at, u.id AS user_id, u.display_name AS user_display_name
     FROM task_notes n
     LEFT JOIN users u ON u.id = n.user_id
     WHERE n.task_id = $1 AND n.deleted_at IS NULL
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [taskId, limit, offset],
  )
  const { rows: countRows } = await query(
    'SELECT count(*) FROM task_notes WHERE task_id = $1 AND deleted_at IS NULL',
    [taskId],
  )
  return {
    notes: rows.map((row) => ({
      id: row.id,
      content: row.content,
      user: row.user_id ? { id: row.user_id, display_name: row.user_display_name } : null,
      created_at: row.created_at,
      edited_at: row.edited_at,
    })),
    notesTotal: Number(countRows[0].count),
  }
}

async function handleGet(req, res, user) {
  const { id } = req.query
  const includeDeleted = req.query.include_deleted === 'true'
  if (includeDeleted && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { rows } = await query(`${TASK_BASE_SELECT} WHERE t.id = $1`, [id])
  if (rows.length === 0) return res.status(404).json({ error: 'Task not found' })
  if (rows[0].deleted_at && !includeDeleted) return res.status(404).json({ error: 'Task not found' })

  const notesLimit = Number.parseInt(req.query.notes_limit, 10) || 25
  const notesOffset = Number.parseInt(req.query.notes_offset, 10) || 0
  const { notes, notesTotal } = await fetchPaginatedNotes(id, notesLimit, notesOffset)

  res.status(200).json({ ...toTask(rows[0]), notes, notes_total: notesTotal })
}

async function handleUpdate(req, res, user) {
  const { id } = req.query
  const body = req.body ?? {}
  const fieldsToUpdate = TASK_AUDIT_FIELDS.filter((field) => field in body)

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  const { rows: existing } = await query('SELECT id FROM tasks WHERE id = $1', [id])
  if (existing.length === 0) return res.status(404).json({ error: 'Task not found' })

  const setClauses = fieldsToUpdate.map((field, i) => `${field} = $${i + 2}`)
  const values = fieldsToUpdate.map((field) => body[field])

  await query(
    `UPDATE tasks SET ${setClauses.join(', ')}, last_updated_by = $${fieldsToUpdate.length + 2} WHERE id = $1`,
    [id, ...values, user.id],
  )

  const { rows } = await query(`${TASK_BASE_SELECT} WHERE t.id = $1`, [id])
  res.status(200).json(toTask(rows[0]))
}

async function handleDelete(req, res, user) {
  const { id } = req.query

  const { rows: existing } = await query('SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL', [id])
  if (existing.length === 0) return res.status(404).json({ error: 'Task not found' })

  await query('UPDATE tasks SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, user.id])

  const { rows: notesToDelete } = await query(
    'SELECT id FROM task_notes WHERE task_id = $1 AND deleted_at IS NULL',
    [id],
  )
  await query('UPDATE task_notes SET deleted_at = now(), deleted_by = $2 WHERE task_id = $1 AND deleted_at IS NULL', [
    id,
    user.id,
  ])

  // Spec requires two audit entries: withAudit (wrapping this handler)
  // writes the task's own deleted_at/deleted_by change; this is the second,
  // summarising the note cascade — not generalizable to other entities, so
  // it's a direct call rather than something withAudit could produce itself.
  if (notesToDelete.length > 0) {
    await logFieldChanges('task', id, user.id, 'deleted', {
      notes_deleted: { from: 0, to: notesToDelete.length },
    })
  }

  res.status(200).json({ deleted: true, notes_deleted: notesToDelete.length })
}

const auditedUpdate = withAudit({ table: 'tasks', entityType: 'task', fields: TASK_AUDIT_FIELDS }, handleUpdate)
const auditedDelete = withAudit(
  { table: 'tasks', entityType: 'task', fields: ['deleted_at', 'deleted_by'] },
  handleDelete,
)

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleGet(req, res, user)
  if (req.method === 'PATCH') return auditedUpdate(req, res, user)
  if (req.method === 'DELETE') return auditedDelete(req, res, user)
  return res.status(405).json({ error: 'Method not allowed' })
})
