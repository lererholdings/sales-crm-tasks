import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

const VALID_ENTITY_TYPES = ['task', 'account', 'task_note', 'task_type', 'user']
const VALID_ACTIONS = ['created', 'updated', 'deleted', 'viewed']
const MAX_LIMIT = 500

function toEntry(row) {
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    user: row.user_id ? { id: row.user_id, display_name: row.user_display_name } : null,
    action: row.action,
    changed_fields: row.changed_fields,
    timestamp: row.timestamp,
  }
}

export default withAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const q = req.query
  const conditions = []
  const params = []

  if (q.user_id) {
    params.push(q.user_id)
    conditions.push(`a.user_id = $${params.length}`)
  }
  if (q.entity_type) {
    if (!VALID_ENTITY_TYPES.includes(q.entity_type)) return res.status(400).json({ error: 'Invalid entity_type' })
    params.push(q.entity_type)
    conditions.push(`a.entity_type = $${params.length}`)
  }
  if (q.action) {
    if (!VALID_ACTIONS.includes(q.action)) return res.status(400).json({ error: 'Invalid action' })
    params.push(q.action)
    conditions.push(`a.action = $${params.length}`)
  }
  if (q.from) {
    params.push(q.from)
    conditions.push(`a.timestamp >= $${params.length}`)
  }
  if (q.to) {
    params.push(q.to)
    conditions.push(`a.timestamp <= $${params.length}`)
  }

  const limit = Math.min(Number.parseInt(q.limit, 10) || 100, MAX_LIMIT)
  const offset = Number.parseInt(q.offset, 10) || 0
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  params.push(limit, offset)
  const { rows } = await query(
    `SELECT a.id, a.entity_type, a.entity_id, a.action, a.changed_fields, a.timestamp,
            u.id AS user_id, u.display_name AS user_display_name
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.timestamp DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
  res.status(200).json(rows.map(toEntry))
})
