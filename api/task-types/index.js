import { withAuth } from '../_lib/auth.js'
import { query } from '../_lib/db.js'

// POST/PATCH (admin-managed create/rename/activate) are Milestone 8's job —
// this milestone only needs the read side for task creation dropdowns.
export default withAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rows } = await query(
    user.role === 'admin'
      ? 'SELECT id, category, name, active FROM task_types ORDER BY category, name'
      : 'SELECT id, category, name, active FROM task_types WHERE active = true ORDER BY category, name',
  )
  res.status(200).json(rows)
})
