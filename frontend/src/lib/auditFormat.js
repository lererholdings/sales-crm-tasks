// Shared between the admin AuditRow (full log table) and TaskHistoryTimeline
// (inline per-task view) so the diff formatting stays identical in both.
export const AUDIT_ACTION_TEXT_CLASS = {
  created: 'text-accent',
  updated: 'text-status-ip-text',
  deleted: 'text-urgent',
  viewed: 'text-text-muted',
}

export function formatAuditValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
