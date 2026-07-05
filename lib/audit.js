import { query } from './db.js'

// Writes one audit_log row per changed field: { field: { from, to } } —
// same shape for every action, including 'created' (from: null), so
// anything reading changed_fields doesn't need to special-case the action.
// Milestone 4 adds generic middleware wrapping *all* mutating endpoints —
// this helper is what that middleware will call internally, so calling it
// directly here for accounts now (per the Milestone 3 spec's explicit
// audit-trail requirement) won't need to be redone, just wrapped.
export async function logFieldChanges(entityType, entityId, userId, action, changes) {
  const fields = Object.keys(changes)
  if (fields.length === 0) return

  await query(
    `INSERT INTO audit_log (entity_type, entity_id, user_id, action, changed_fields)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, userId, action, JSON.stringify(changes)],
  )
}

// Builds the { field: { from: null, to: value } } shape for a freshly
// created row, skipping fields that weren't actually set.
export function toCreatedChanges(fields) {
  const changes = {}
  for (const [field, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) {
      changes[field] = { from: null, to: value }
    }
  }
  return changes
}

function diffRows(before, after, fields) {
  const changes = {}
  for (const field of fields) {
    const from = before?.[field] ?? null
    const to = after?.[field] ?? null
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to }
  }
  return changes
}

function pick(row, fields) {
  const result = {}
  for (const field of fields) result[field] = row[field]
  return result
}

// Generic audit middleware — wraps a mutating handler so POST/PATCH/DELETE
// get audit_log entries automatically, without the handler calling
// logFieldChanges itself (see design.md section 7: "Audit logging is
// handled by middleware — not repeated per endpoint"). Diffs are computed
// by comparing full raw DB row snapshots before/after against a declared
// list of "diffable" fields (deliberately excludes bookkeeping columns like
// updated_at/created_at/id — not passed in `fields` at all), not by the
// handler manually tracking what it changed.
//
// PATCH/DELETE: fetches the row before calling the handler, then again
// after, and diffs the two. A soft-delete is just an UPDATE to
// deleted_at/deleted_by under the hood, so DELETE reuses the exact same
// diffing path as PATCH — no special-casing needed, as long as those two
// columns are included in `fields` for the relevant table.
// POST: no "before" row exists (nothing to fetch by id yet), so the after
// row is logged via toCreatedChanges instead of a diff.
//
// Only logs on a successful (2xx) response — patches res.json to observe
// the outcome the handler already produced, rather than requiring the
// handler to report back explicitly.
export function withAudit({ table, entityType, fields, idParam = 'id' }, handler) {
  return async (req, res, user) => {
    const id = req.method === 'POST' ? null : req.query[idParam]

    let before = null
    if (id) {
      const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id])
      before = rows[0] ?? null
    }

    const originalJson = res.json.bind(res)
    let captured = null
    res.json = (payload) => {
      captured = { statusCode: res.statusCode, payload }
      return originalJson(payload)
    }

    await handler(req, res, user)

    if (!captured) return
    const { statusCode, payload } = captured
    if (statusCode < 200 || statusCode >= 300) return

    const afterId = id ?? payload?.id
    if (!afterId) return

    const { rows: afterRows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [afterId])
    const after = afterRows[0]
    if (!after) return

    if (req.method === 'POST') {
      await logFieldChanges(entityType, afterId, user.id, 'created', toCreatedChanges(pick(after, fields)))
    } else {
      const action = req.method === 'DELETE' ? 'deleted' : 'updated'
      await logFieldChanges(entityType, afterId, user.id, action, diffRows(before, after, fields))
    }
  }
}
