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

// Drops keys no longer configurable and appends any configurable column
// missing from a stored order (e.g. one added after the user last saved
// their preferences), so ColumnManager always has a complete, valid list.
export function normalizeColumnOrder(order) {
  const known = new Set(DEFAULT_COLUMN_ORDER)
  const valid = (order ?? []).filter((key) => known.has(key))
  const missing = DEFAULT_COLUMN_ORDER.filter((key) => !valid.includes(key))
  return [...valid, ...missing]
}

export function getVisibleOrderedColumns(order, visibility) {
  return normalizeColumnOrder(order)
    .map((key) => CONFIGURABLE_COLUMNS.find((c) => c.key === key))
    .filter((col) => col && visibility[col.key] !== false)
}
