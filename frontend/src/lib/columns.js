import { getVisibleOrderedColumns, normalizeColumnOrder } from './columnUtils.js'

// Mirrors design.md's task table column list. task_name is always the first
// column — it hosts TaskNameCell's context menu, so unlike the rest it isn't
// hideable or reorderable.
export const TASK_NAME_COLUMN = { key: 'task_name', label: 'Task', sortKey: 'task_name' }

export const CONFIGURABLE_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'assignee', label: 'Assignee', sortKey: 'assignee_name' },
  { key: 'next_action', label: 'Next action' },
  { key: 'priority', label: 'Priority', sortKey: 'priority' },
  { key: 'status', label: 'Status', sortKey: 'status' },
  { key: 'eta', label: 'ETA', sortKey: 'eta' },
  { key: 'notes_preview', label: 'Notes' },
  { key: 'last_updated', label: 'Last updated', sortKey: 'updated_at' },
]

export const DEFAULT_COLUMN_ORDER = CONFIGURABLE_COLUMNS.map((c) => c.key)

export function normalizeTaskColumnOrder(order) {
  return normalizeColumnOrder(order, DEFAULT_COLUMN_ORDER)
}

export function getVisibleOrderedTaskColumns(order, visibility) {
  return getVisibleOrderedColumns(order, visibility, CONFIGURABLE_COLUMNS, DEFAULT_COLUMN_ORDER)
}
