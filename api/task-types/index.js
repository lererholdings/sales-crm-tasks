import { withAuth } from '../../lib/auth.js'
import { withAudit } from '../../lib/audit.js'
import { query } from '../../lib/db.js'
import { sendError } from '../../lib/errors.js'
import { validateTextFields } from '../../lib/validation.js'

const VALID_CATEGORIES = ['pre-sale', 'post-sale', 'account']
const TASK_TYPE_AUDIT_FIELDS = ['category', 'name', 'active']
const TASK_TYPE_TEXT_FIELD_RULES = { name: { maxLength: 100 } }

async function handleGet(req, res, user) {
  const { rows } = await query(
    user.role === 'admin'
      ? 'SELECT id, category, name, active FROM task_types ORDER BY category, name'
      : 'SELECT id, category, name, active FROM task_types WHERE active = true ORDER BY category, name',
  )
  res.status(200).json(rows)
}

async function handleCreate(req, res, user) {
  if (user.role !== 'admin') return sendError(res, 403, 'Forbidden')

  const body = req.body ?? {}
  const { category, name } = body
  if (!VALID_CATEGORIES.includes(category)) {
    return sendError(res, 400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`)
  }
  const textFieldError = validateTextFields(body, TASK_TYPE_TEXT_FIELD_RULES)
  if (textFieldError) return sendError(res, 400, textFieldError)
  if (!name || typeof name !== 'string' || !name.trim()) return sendError(res, 400, 'name is required')

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
  if (user.role !== 'admin') return sendError(res, 403, 'Forbidden')

  const { id } = req.query
  if (!id) return sendError(res, 400, 'id query param is required')

  const body = req.body ?? {}
  const fieldsToUpdate = ['name', 'active'].filter((field) => field in body)
  if (fieldsToUpdate.length === 0) {
    return sendError(res, 400, 'No updatable fields provided')
  }
  const textFieldError = validateTextFields(body, TASK_TYPE_TEXT_FIELD_RULES)
  if (textFieldError) return sendError(res, 400, textFieldError)
  if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) {
    return sendError(res, 400, 'name cannot be empty')
  }
  if ('active' in body && typeof body.active !== 'boolean') {
    return sendError(res, 400, 'active must be a boolean')
  }

  const setClauses = fieldsToUpdate.map((field, i) => `${field} = $${i + 2}`)
  const values = fieldsToUpdate.map((field) => body[field])

  const { rows } = await query(
    `UPDATE task_types SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id, category, name, active`,
    [id, ...values],
  )
  if (rows.length === 0) return sendError(res, 404, 'Task type not found')
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
  return sendError(res, 405, 'Method not allowed')
})
