import { withAuth } from '../_lib/auth.js'
import { query } from '../_lib/db.js'

function toAccount(row, { includeAcv }) {
  const account = {
    id: row.id,
    name: row.name,
    country: row.country,
    sfdc_account_url: row.sfdc_account_url,
    last_updated_by: row.updated_by_id
      ? { id: row.updated_by_id, display_name: row.updated_by_name }
      : null,
    updated_at: row.updated_at,
  }
  if (includeAcv) {
    account.acv = row.acv === null ? null : Number(row.acv)
  }
  return account
}

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') {
    const search = typeof req.query.search === 'string' ? req.query.search : null
    const includeAcv = req.query.include === 'acv'

    const { rows } = await query(
      `SELECT a.id, a.name, a.country, a.sfdc_account_url, a.acv, a.updated_at,
              u.id AS updated_by_id, u.display_name AS updated_by_name
       FROM accounts a
       LEFT JOIN users u ON u.id = a.last_updated_by
       WHERE ($1::text IS NULL OR a.name ILIKE '%' || $1 || '%')
       ORDER BY a.name`,
      [search],
    )
    return res.status(200).json(rows.map((row) => toAccount(row, { includeAcv })))
  }

  if (req.method === 'POST') {
    const { name, country, acv, sfdc_account_url: sfdcAccountUrl } = req.body ?? {}
    if (!name || !country) {
      return res.status(400).json({ error: 'name and country are required' })
    }

    const { rows } = await query(
      `INSERT INTO accounts (name, country, acv, sfdc_account_url, last_updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, country, sfdc_account_url, acv, updated_at`,
      [name, country, acv ?? null, sfdcAccountUrl ?? null, user.id],
    )
    const row = rows[0]
    return res
      .status(201)
      .json(toAccount({ ...row, updated_by_id: user.id, updated_by_name: user.displayName }, { includeAcv: true }))
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
