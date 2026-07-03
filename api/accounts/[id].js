import { withAuth } from '../_lib/auth.js'
import { query } from '../_lib/db.js'
import { logFieldChanges } from '../_lib/audit.js'

function toAccount(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    sfdc_account_url: row.sfdc_account_url,
    acv: row.acv === null ? null : Number(row.acv),
    last_updated_by: row.updated_by_id
      ? { id: row.updated_by_id, display_name: row.updated_by_name }
      : null,
    updated_at: row.updated_at,
  }
}

const PATCHABLE_FIELDS = ['name', 'country', 'acv', 'sfdc_account_url']

export default withAuth(async (req, res, user) => {
  const { id } = req.query

  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT a.id, a.name, a.country, a.sfdc_account_url, a.acv, a.updated_at,
              u.id AS updated_by_id, u.display_name AS updated_by_name
       FROM accounts a
       LEFT JOIN users u ON u.id = a.last_updated_by
       WHERE a.id = $1`,
      [id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Account not found' })
    return res.status(200).json(toAccount(rows[0]))
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {}
    const fieldsToUpdate = PATCHABLE_FIELDS.filter((field) => field in body)
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' })
    }

    const { rows: currentRows } = await query('SELECT * FROM accounts WHERE id = $1', [id])
    if (currentRows.length === 0) return res.status(404).json({ error: 'Account not found' })
    const current = currentRows[0]

    // ACV comes back from pg as a string (NUMERIC) — normalize before diffing
    // against the incoming JSON number so unchanged values don't get logged.
    const changes = {}
    for (const field of fieldsToUpdate) {
      const from = field === 'acv' && current[field] !== null ? Number(current[field]) : current[field]
      const to = body[field]
      if (from !== to) changes[field] = { from, to }
    }

    const setClauses = fieldsToUpdate.map((field, i) => `${field} = $${i + 2}`)
    const values = fieldsToUpdate.map((field) => body[field])

    const { rows } = await query(
      `UPDATE accounts SET ${setClauses.join(', ')}, last_updated_by = $${fieldsToUpdate.length + 2}
       WHERE id = $1
       RETURNING id, name, country, sfdc_account_url, acv, updated_at`,
      [id, ...values, user.id],
    )
    const updated = rows[0]

    await logFieldChanges('account', id, user.id, changes)

    return res
      .status(200)
      .json(toAccount({ ...updated, updated_by_id: user.id, updated_by_name: user.displayName }))
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
