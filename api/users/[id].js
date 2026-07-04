import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

export default withAuth(async (req, res, user) => {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { role } = req.body ?? {}
  if (role !== 'admin' && role !== 'member') {
    return res.status(400).json({ error: 'role must be "admin" or "member"' })
  }

  const { rows } = await query(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, display_name, email, role',
    [role, req.query.id],
  )
  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.status(200).json(rows[0])
})
