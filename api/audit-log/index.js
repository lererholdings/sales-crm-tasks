import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

const VALID_ENTITY_TYPES = ['task', 'account', 'task_note', 'task_type', 'user']
const VALID_ACTIONS = ['created', 'updated', 'deleted', 'viewed']
const MAX_LIMIT = 500

// A raw entity_type/entity_id isn't meaningful to a human — a task_note's
// entity_id is the note's own id, not anything anyone would recognize. Each
// case resolves a display label from the joined name (falling back to the
// short id when the source row no longer exists) and, where there's a
// sensible place to send someone, a link target. `user`/`task_type` don't
// have a per-item page, so they link to the relevant admin tab rather than
// a specific row.
function deriveEntityDisplay(row) {
  const shortId = row.entity_id.slice(0, 8)
  switch (row.entity_type) {
    case 'task':
      return {
        label: row.task_name ?? `task · ${shortId}`,
        link: row.task_id ? { type: 'task', id: row.task_id } : null,
      }
    case 'task_note':
      return {
        label: row.task_name ? `Note on ${row.task_name}` : `task_note · ${shortId}`,
        link: row.task_id ? { type: 'task', id: row.task_id } : null,
      }
    case 'account':
      return {
        label: row.account_name ?? `account · ${shortId}`,
        link: row.account_id ? { type: 'account', id: row.account_id } : null,
      }
    case 'user':
      return {
        label: row.target_user_name ?? `user · ${shortId}`,
        link: { type: 'user' },
      }
    case 'task_type':
      return {
        label: row.task_type_name ? `${row.task_type_category} · ${row.task_type_name}` : `task_type · ${shortId}`,
        link: { type: 'task_type' },
      }
    default:
      return { label: `${row.entity_type} · ${shortId}`, link: null }
  }
}

function toEntry(row) {
  const { label, link } = deriveEntityDisplay(row)
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_label: label,
    entity_link: link,
    user: row.user_id ? { id: row.user_id, display_name: row.user_display_name } : null,
    action: row.action,
    changed_fields: row.changed_fields,
    timestamp: row.timestamp,
    task_id: row.task_id,
    account_id: row.account_id,
  }
}

export default withAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const q = req.query
  // Full unscoped access (browsing/filtering everything) is admin-only. A
  // task-scoped query is open to any authenticated user — that's just "this
  // task's own history," which the task's own page already exposes to
  // whoever can see the task, not a broader audit surface.
  if (user.role !== 'admin' && !q.task_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const conditions = []
  const filterParams = []

  if (q.task_id) {
    filterParams.push(q.task_id)
    conditions.push(`a.task_id = $${filterParams.length}`)
  }
  if (q.user_id) {
    filterParams.push(q.user_id)
    conditions.push(`a.user_id = $${filterParams.length}`)
  }
  if (q.entity_type) {
    if (!VALID_ENTITY_TYPES.includes(q.entity_type)) return res.status(400).json({ error: 'Invalid entity_type' })
    filterParams.push(q.entity_type)
    conditions.push(`a.entity_type = $${filterParams.length}`)
  }
  if (q.action) {
    if (!VALID_ACTIONS.includes(q.action)) return res.status(400).json({ error: 'Invalid action' })
    filterParams.push(q.action)
    conditions.push(`a.action = $${filterParams.length}`)
  }
  if (q.from) {
    filterParams.push(q.from)
    conditions.push(`a.timestamp >= $${filterParams.length}`)
  }
  if (q.to) {
    filterParams.push(q.to)
    conditions.push(`a.timestamp <= $${filterParams.length}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Same filters, no LEFT JOIN needed (nothing filters on the joined user's
  // own columns) — powers the pager's jump-to-last / page dropdown.
  const { rows: countRows } = await query(`SELECT COUNT(1) AS total FROM audit_log a ${whereClause}`, filterParams)
  const total = Number(countRows[0].total)

  const limit = Math.min(Number.parseInt(q.limit, 10) || 100, MAX_LIMIT)
  const offset = Number.parseInt(q.offset, 10) || 0
  const listParams = [...filterParams, limit, offset]

  const { rows } = await query(
    `SELECT a.id, a.entity_type, a.entity_id, a.action, a.changed_fields, a.timestamp, a.task_id, a.account_id,
            u.id AS user_id, u.display_name AS user_display_name,
            t.task_name, acc.name AS account_name, tu.display_name AS target_user_name,
            tt.category AS task_type_category, tt.name AS task_type_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN tasks t ON t.id = a.task_id
     LEFT JOIN accounts acc ON acc.id = a.account_id
     LEFT JOIN users tu ON tu.id = a.entity_id AND a.entity_type = 'user'
     LEFT JOIN task_types tt ON tt.id = a.entity_id AND a.entity_type = 'task_type'
     ${whereClause}
     ORDER BY a.timestamp DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  )
  res.status(200).json({ entries: rows.map(toEntry), total })
})
