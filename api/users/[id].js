import { withAuth } from '../../lib/auth.js'
import { withAudit } from '../../lib/audit.js'
import { query } from '../../lib/db.js'
import { sendError } from '../../lib/errors.js'

async function handleUpdate(req, res, user) {
  if (req.method !== 'PATCH') {
    return sendError(res, 405, 'Method not allowed')
  }
  if (user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden')
  }

  const { role } = req.body ?? {}
  if (role !== 'admin' && role !== 'member') {
    return sendError(res, 400, 'role must be "admin" or "member"')
  }

  const { rows } = await query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, display_name, email, role',
    [role, req.query.id],
  )
  if (rows.length === 0) {
    return sendError(res, 404, 'User not found')
  }
  res.status(200).json(rows[0])
}

export default withAuth(withAudit({ table: 'users', entityType: 'user', fields: ['role'] }, handleUpdate))
