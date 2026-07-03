import { query } from './db.js'

// Writes one audit_log row per changed field: { field: { from, to } }.
// Milestone 4 adds generic middleware wrapping *all* mutating endpoints —
// this helper is what that middleware will call internally, so calling it
// directly here for accounts now (per the Milestone 3 spec's explicit
// audit-trail requirement) won't need to be redone, just wrapped.
export async function logFieldChanges(entityType, entityId, userId, changes) {
  const fields = Object.keys(changes)
  if (fields.length === 0) return

  await query(
    `INSERT INTO audit_log (entity_type, entity_id, user_id, action, changed_fields)
     VALUES ($1, $2, $3, 'updated', $4)`,
    [entityType, entityId, userId, JSON.stringify(changes)],
  )
}
