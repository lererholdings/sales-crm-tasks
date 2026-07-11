import { withAuth } from '../../lib/auth.js'
import { withAudit } from '../../lib/audit.js'
import { query } from '../../lib/db.js'

const VALID_CATEGORIES = ['pre-sale', 'post-sale', 'account']
const TASK_TYPE_AUDIT_FIELDS = ['category', 'name', 'active']

async function handleGet(req, res, user) {
  const { rows } = await query(
    user.role === 'admin'
      ? 'SELECT id, category, name, active FROM task_types ORDER BY category, name'
      : 'SELECT id, category, name, active FROM task_types WHERE active = true ORDER BY category, name',
  )
  res.status(200).json(rows)
}

async function handleCreate(req, res, user) {
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { category, name } = req.body ?? {}
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` })
  }
  if (!name) return res.status(400).json({ error: 'name is required' })

  const { rows } = await query(
    'INSERT INTO task_types (category, name) VALUES ($1, $2) RETURNING id',
    [category, name],
  )
  const { rows: fullRows } = await query('SELECT id, category, name, active FROM task_types WHERE id = $1', [
    rows[0].id,
  ])
  res.status(201).json(fullRows[0])
}

// PATCH takes the id via ?id= rather than a /:id path segment — this file
// already exists at the api/ function-count ceiling (see design.md section
// 12, "Shared backend code lives in lib/" decision log entry: 12 Serverless
// Functions max on the Hobby plan). A dedicated [id].js would be the 13th
// file; folding the update into this one instead (same technique already
// used for GET /api/users?me=true) keeps the count at 12.
async function handleUpdate(req, res, user) {
  if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id query param is required' })

  const body = req.body ?? {}
  const fieldsToUpdate = ['name', 'active'].filter((field) => field in body)
  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }
  if ('name' in body && !body.name) {
    return res.status(400).json({ error: 'name cannot be empty' })
  }
  if ('active' in body && typeof body.active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' })
  }

  const setClauses = fieldsToUpdate.map((field, i) => `${field} = $${i + 2}`)
  const values = fieldsToUpdate.map((field) => body[field])

  const { rows } = await query(
    `UPDATE task_types SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id, category, name, active`,
    [id, ...values],
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Task type not found' })
  res.status(200).json(rows[0])
}

const auditedCreate = withAudit(
  { table: 'task_types', entityType: 'task_type', fields: TASK_TYPE_AUDIT_FIELDS },
  handleCreate,
)
const auditedUpdate = withAudit(
  { table: 'task_types', entityType: 'task_type', fields: TASK_TYPE_AUDIT_FIELDS },
  handleUpdate,
)

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleGet(req, res, user)
  if (req.method === 'POST') return auditedCreate(req, res, user)
  if (req.method === 'PATCH') return auditedUpdate(req, res, user)
  return res.status(405).json({ error: 'Method not allowed' })
})
