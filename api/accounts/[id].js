import { withAuth } from '../../lib/auth.js'
import { query } from '../../lib/db.js'
import { logFieldChanges } from '../../lib/audit.js'

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
    deleted_at: row.deleted_at ?? null,
  }
}

const PATCHABLE_FIELDS = ['name', 'country', 'acv', 'sfdc_account_url']

export default withAuth(async (req, res, user) => {
  const { id } = req.query

  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT a.id, a.name, a.country, a.sfdc_account_url, a.acv, a.updated_at, a.deleted_at,
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
       RETURNING id, name, country, sfdc_account_url, acv, updated_at, deleted_at`,
      [id, ...values, user.id],
    )
    const updated = rows[0]

    await logFieldChanges('account', id, user.id, 'updated', changes)

    return res
      .status(200)
      .json(toAccount({ ...updated, updated_by_id: user.id, updated_by_name: user.displayName }))
  }

  // Archive, not a hard delete — issue #5. Admin only, and only when the
  // account has no active (non-done, non-deleted) tasks against it. Unlike
  // tasks' soft delete, archived accounts stay visible everywhere (sorted
  // last, greyed out) rather than being hidden by default.
  if (req.method === 'DELETE') {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can archive an account' })
    }

    const { rows: existing } = await query('SELECT id, deleted_at FROM accounts WHERE id = $1', [id])
    if (existing.length === 0) return res.status(404).json({ error: 'Account not found' })
    if (existing[0].deleted_at) return res.status(400).json({ error: 'Account is already archived' })

    const { rows: activeTasks } = await query(
      "SELECT id FROM tasks WHERE account_id = $1 AND deleted_at IS NULL AND status != 'done' LIMIT 1",
      [id],
    )
    if (activeTasks.length > 0) {
      return res.status(409).json({ error: 'Cannot archive an account with active tasks' })
    }

    const { rows } = await query(
      `UPDATE accounts SET deleted_at = now(), deleted_by = $2
       WHERE id = $1
       RETURNING id, name, country, sfdc_account_url, acv, updated_at, deleted_at`,
      [id, user.id],
    )
    const archived = rows[0]

    await logFieldChanges('account', id, user.id, 'deleted', { deleted_at: { from: null, to: archived.deleted_at } })

    return res
      .status(200)
      .json(toAccount({ ...archived, updated_by_id: user.id, updated_by_name: user.displayName }))
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
