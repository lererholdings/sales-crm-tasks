import { query } from './db.js'

export const NOTE_AUDIT_FIELDS = ['content']
export const MAX_NOTE_LENGTH = 10000

export const NOTE_BASE_SELECT = `
  SELECT n.id, n.content, n.created_at, n.edited_at,
         u.id AS user_id, u.display_name AS user_display_name,
         lu.id AS last_updated_by_id, lu.display_name AS last_updated_by_name
  FROM task_notes n
  LEFT JOIN users u ON u.id = n.user_id
  LEFT JOIN users lu ON lu.id = n.last_updated_by
`

export function toNote(row) {
  return {
    id: row.id,
    content: row.content,
    user: row.user_id ? { id: row.user_id, display_name: row.user_display_name } : null,
    created_at: row.created_at,
    edited_at: row.edited_at,
    last_updated_by: row.last_updated_by_id
      ? { id: row.last_updated_by_id, display_name: row.last_updated_by_name }
      : null,
  }
}

const DEFAULT_NOTES_PREVIEW_COUNT = 2

// No user_preferences row exists until one is written (GET/PATCH /api/preferences
// lands in Milestone 6), so this falls back to the column's own default.
export async function getNotesPreviewCount(userId) {
  const { rows } = await query('SELECT notes_preview_count FROM user_preferences WHERE user_id = $1', [userId])
  return rows[0]?.notes_preview_count ?? DEFAULT_NOTES_PREVIEW_COUNT
}
