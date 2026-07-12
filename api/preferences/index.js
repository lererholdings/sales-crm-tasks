import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'
import { sendError } from '../../lib/errors.js'

const VALID_THEMES = ['light', 'dark']

const DEFAULTS = {
  column_order: [],
  column_visibility: {},
  notes_preview_count: 2,
  accounts_column_order: [],
  accounts_column_visibility: {},
  theme: null,
}
const JSON_ARRAY_FIELDS = ['column_order', 'accounts_column_order']
const JSON_OBJECT_FIELDS = ['column_visibility', 'accounts_column_visibility']
const PATCHABLE_FIELDS = [...JSON_ARRAY_FIELDS, ...JSON_OBJECT_FIELDS, 'notes_preview_count', 'theme']

async function handleGet(req, res, user) {
  const { rows } = await query(
    `SELECT column_order, column_visibility, notes_preview_count,
            accounts_column_order, accounts_column_visibility, theme
     FROM user_preferences WHERE user_id = $1`,
    [user.id],
  )
  res.status(200).json(rows[0] ?? DEFAULTS)
}

async function handlePatch(req, res, user) {
  const body = req.body ?? {}
  const provided = PATCHABLE_FIELDS.filter((field) => field in body)
  if (provided.length === 0) {
    return sendError(res, 400, 'No updatable fields provided')
  }
  for (const field of JSON_ARRAY_FIELDS) {
    if (field in body && !Array.isArray(body[field])) {
      return sendError(res, 400, `${field} must be an array`)
    }
  }
  for (const field of JSON_OBJECT_FIELDS) {
    if (field in body && (typeof body[field] !== 'object' || body[field] === null || Array.isArray(body[field]))) {
      return sendError(res, 400, `${field} must be an object`)
    }
  }
  if ('notes_preview_count' in body && !Number.isInteger(body.notes_preview_count)) {
    return sendError(res, 400, 'notes_preview_count must be an integer')
  }
  if ('theme' in body && !VALID_THEMES.includes(body.theme)) {
    return sendError(res, 400, `theme must be one of: ${VALID_THEMES.join(', ')}`)
  }

  // Upsert: a user_preferences row may not exist yet (nothing creates one at
  // signup). ON CONFLICT covers first-ever PATCH, while the CASE/EXCLUDED
  // pairs make the update partial — a field absent from the request keeps
  // its existing stored value rather than being overwritten with a default.
  const { rows } = await query(
    `INSERT INTO user_preferences (
       user_id, column_order, column_visibility, notes_preview_count,
       accounts_column_order, accounts_column_visibility, theme
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       column_order = CASE WHEN $8 THEN EXCLUDED.column_order ELSE user_preferences.column_order END,
       column_visibility = CASE WHEN $9 THEN EXCLUDED.column_visibility ELSE user_preferences.column_visibility END,
       notes_preview_count = CASE WHEN $10 THEN EXCLUDED.notes_preview_count ELSE user_preferences.notes_preview_count END,
       accounts_column_order = CASE WHEN $11 THEN EXCLUDED.accounts_column_order ELSE user_preferences.accounts_column_order END,
       accounts_column_visibility = CASE WHEN $12 THEN EXCLUDED.accounts_column_visibility ELSE user_preferences.accounts_column_visibility END,
       theme = CASE WHEN $13 THEN EXCLUDED.theme ELSE user_preferences.theme END
     RETURNING column_order, column_visibility, notes_preview_count, accounts_column_order, accounts_column_visibility, theme`,
    [
      user.id,
      JSON.stringify(body.column_order ?? DEFAULTS.column_order),
      JSON.stringify(body.column_visibility ?? DEFAULTS.column_visibility),
      body.notes_preview_count ?? DEFAULTS.notes_preview_count,
      JSON.stringify(body.accounts_column_order ?? DEFAULTS.accounts_column_order),
      JSON.stringify(body.accounts_column_visibility ?? DEFAULTS.accounts_column_visibility),
      body.theme ?? DEFAULTS.theme,
      provided.includes('column_order'),
      provided.includes('column_visibility'),
      provided.includes('notes_preview_count'),
      provided.includes('accounts_column_order'),
      provided.includes('accounts_column_visibility'),
      provided.includes('theme'),
    ],
  )
  res.status(200).json(rows[0])
}

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleGet(req, res, user)
  if (req.method === 'PATCH') return handlePatch(req, res, user)
  return sendError(res, 405, 'Method not allowed')
})
