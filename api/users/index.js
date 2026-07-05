import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

export default withAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Cheap "who am I" lookup — withAuth already resolved this from the JWT,
  // so no extra query needed. Avoids a dedicated api/ file just for this
  // (see design.md section 12 on the Vercel Hobby function-count ceiling).
  if (req.query?.me === 'true') {
    return res.status(200).json({ id: user.id, display_name: user.displayName, email: user.email, role: user.role })
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
