import { withAuth } from '../../../../lib/auth.js'
import { withAudit } from '../../../../lib/audit.js'
import { query } from '../../../../lib/db.js'
import { NOTE_AUDIT_FIELDS, NOTE_BASE_SELECT, toNote } from '../../../../lib/notes.js'

async function handleUpdate(req, res, user) {
  const { noteId } = req.query
  const { content } = req.body ?? {}
  if (!content) return res.status(400).json({ error: 'content is required' })

  const { rows } = await query(
    'SELECT id, task_id, user_id, created_at FROM task_notes WHERE id = $1 AND deleted_at IS NULL',
    [noteId],
  )
  const note = rows[0]
  if (!note) return res.status(404).json({ error: 'Note not found' })

  // Both checks are required by design.md's edit permission rule — enforced
  // server-side, not just hidden in the UI.
  if (note.user_id !== user.id) {
    return res.status(403).json({ error: 'Only the original author can edit this note' })
  }
  // Excludes this note's own id explicitly rather than relying solely on
  // "created_at > note.created_at" — node-postgres reads timestamptz into a
  // JS Date, which truncates to millisecond precision, so a round-tripped
  // value can compare as "less than" the DB's own microsecond-precision
  // original and make a note appear newer than itself.
  const { rows: newerRows } = await query(
    'SELECT id FROM task_notes WHERE task_id = $1 AND created_at > $2 AND id != $3 AND deleted_at IS NULL',
    [note.task_id, note.created_at, note.id],
  )
  if (newerRows.length > 0) {
    return res.status(403).json({ error: 'Cannot edit — a newer note already exists on this task' })
  }

  await query('UPDATE task_notes SET content = $2, edited_at = now(), last_updated_by = $3 WHERE id = $1', [
    noteId,
    content,
    user.id,
  ])

  const { rows: updatedRows } = await query(`${NOTE_BASE_SELECT} WHERE n.id = $1`, [noteId])
  res.status(200).json(toNote(updatedRows[0]))
}

const auditedUpdate = withAudit(
  {
    table: 'task_notes',
    entityType: 'task_note',
    fields: NOTE_AUDIT_FIELDS,
    idParam: 'noteId',
    deriveContext: (row) => ({ taskId: row.task_id }),
  },
  handleUpdate,
)

export default withAuth(async (req, res, user) => {
  if (req.method === 'PATCH') return auditedUpdate(req, res, user)
  return res.status(405).json({ error: 'Method not allowed' })
})
