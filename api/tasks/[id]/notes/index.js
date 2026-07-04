import { withAuth } from '../../../../lib/auth.js'
import { withAudit } from '../../../../lib/audit.js'
import { query } from '../../../../lib/db.js'
import { NOTE_AUDIT_FIELDS, NOTE_BASE_SELECT, getNotesPreviewCount, toNote } from '../../../../lib/notes.js'

async function findTask(taskId) {
  const { rows } = await query('SELECT id, deleted_at FROM tasks WHERE id = $1', [taskId])
  return rows[0] ?? null
}

async function handleList(req, res, user) {
  const { id: taskId } = req.query
  const includeDeleted = req.query.include_deleted === 'true'
  if (includeDeleted && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const task = await findTask(taskId)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  if (task.deleted_at && !includeDeleted) return res.status(404).json({ error: 'Task not found' })

  const deletedFilter = includeDeleted ? '' : 'AND n.deleted_at IS NULL'
  const { rows: countRows } = await query(
    `SELECT count(*) FROM task_notes n WHERE n.task_id = $1 ${deletedFilter}`,
    [taskId],
  )
  const total = Number(countRows[0].count)

  if (req.query.preview === 'true') {
    const limit = await getNotesPreviewCount(user.id)
    const { rows } = await query(
      `${NOTE_BASE_SELECT} WHERE n.task_id = $1 ${deletedFilter} ORDER BY n.created_at DESC LIMIT $2`,
      [taskId, limit],
    )
    return res.status(200).json({ notes: rows.map(toNote), total, limit, offset: 0 })
  }

  const limit = Number.parseInt(req.query.limit, 10) || 25
  const offset = Number.parseInt(req.query.offset, 10) || 0
  const { rows } = await query(
    `${NOTE_BASE_SELECT} WHERE n.task_id = $1 ${deletedFilter} ORDER BY n.created_at DESC LIMIT $2 OFFSET $3`,
    [taskId, limit, offset],
  )
  res.status(200).json({ notes: rows.map(toNote), total, limit, offset })
}

async function handleCreate(req, res, user) {
  const { id: taskId } = req.query
  const { content } = req.body ?? {}
  if (!content) return res.status(400).json({ error: 'content is required' })

  const task = await findTask(taskId)
  if (!task || task.deleted_at) return res.status(404).json({ error: 'Task not found' })

  const { rows } = await query(
    'INSERT INTO task_notes (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
    [taskId, user.id, content],
  )
  const { rows: fullRows } = await query(`${NOTE_BASE_SELECT} WHERE n.id = $1`, [rows[0].id])
  res.status(201).json(toNote(fullRows[0]))
}

const auditedCreate = withAudit(
  { table: 'task_notes', entityType: 'task_note', fields: NOTE_AUDIT_FIELDS },
  handleCreate,
)

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleList(req, res, user)
  if (req.method === 'POST') return auditedCreate(req, res, user)
  return res.status(405).json({ error: 'Method not allowed' })
})
