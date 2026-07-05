import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'

const DEFAULTS = { column_order: [], column_visibility: {}, notes_preview_count: 2 }
const PATCHABLE_FIELDS = ['column_order', 'column_visibility', 'notes_preview_count']

async function handleGet(req, res, user) {
  const { rows } = await query(
    'SELECT column_order, column_visibility, notes_preview_count FROM user_preferences WHERE user_id = $1',
    [user.id],
  )
  res.status(200).json(rows[0] ?? DEFAULTS)
}

async function handlePatch(req, res, user) {
  const body = req.body ?? {}
  const provided = PATCHABLE_FIELDS.filter((field) => field in body)
  if (provided.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }
  if ('column_order' in body && !Array.isArray(body.column_order)) {
    return res.status(400).json({ error: 'column_order must be an array' })
  }
  if ('column_visibility' in body && (typeof body.column_visibility !== 'object' || body.column_visibility === null || Array.isArray(body.column_visibility))) {
    return res.status(400).json({ error: 'column_visibility must be an object' })
  }
  if ('notes_preview_count' in body && !Number.isInteger(body.notes_preview_count)) {
    return res.status(400).json({ error: 'notes_preview_count must be an integer' })
  }

  // Upsert: a user_preferences row may not exist yet (nothing creates one at
  // signup). ON CONFLICT covers first-ever PATCH, while the CASE/EXCLUDED
  // pairs make the update partial — a field absent from the request keeps
  // its existing stored value rather than being overwritten with a default.
  const { rows } = await query(
    `INSERT INTO user_preferences (user_id, column_order, column_visibility, notes_preview_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       column_order = CASE WHEN $5 THEN EXCLUDED.column_order ELSE user_preferences.column_order END,
       column_visibility = CASE WHEN $6 THEN EXCLUDED.column_visibility ELSE user_preferences.column_visibility END,
       notes_preview_count = CASE WHEN $7 THEN EXCLUDED.notes_preview_count ELSE user_preferences.notes_preview_count END
     RETURNING column_order, column_visibility, notes_preview_count`,
    [
      user.id,
      JSON.stringify(body.column_order ?? DEFAULTS.column_order),
      JSON.stringify(body.column_visibility ?? DEFAULTS.column_visibility),
      body.notes_preview_count ?? DEFAULTS.notes_preview_count,
      provided.includes('column_order'),
      provided.includes('column_visibility'),
      provided.includes('notes_preview_count'),
    ],
  )
  res.status(200).json(rows[0])
}

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleGet(req, res, user)
  if (req.method === 'PATCH') return handlePatch(req, res, user)
  return res.status(405).json({ error: 'Method not allowed' })
})
