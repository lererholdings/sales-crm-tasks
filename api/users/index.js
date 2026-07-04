import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rows } = await query(
    'SELECT id, display_name, email, role FROM users ORDER BY display_name',
  )
  res.status(200).json(
    rows.map((row) => ({
      id: row.id,
      display_name: row.display_name,
      email: row.email,
      role: row.role,
    })),
  )
})
