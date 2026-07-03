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
