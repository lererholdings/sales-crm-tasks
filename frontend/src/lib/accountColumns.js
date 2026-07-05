import { getVisibleOrderedColumns, normalizeColumnOrder } from './columnUtils.js'

// Mirrors lib/columns.js's task column setup. name is always the first
// column — it's the primary click target for opening the side panel, so
// unlike the rest it isn't hideable or reorderable.
export const ACCOUNT_NAME_COLUMN = { key: 'name', label: 'Name', sortKey: 'name' }

export const CONFIGURABLE_ACCOUNT_COLUMNS = [
  { key: 'country', label: 'Country', sortKey: 'country' },
  { key: 'acv', label: 'ACV', sortKey: 'acv' },
  { key: 'sfdc', label: 'SFDC' },
  { key: 'last_updated', label: 'Last updated', sortKey: 'updated_at' },
]

export const DEFAULT_ACCOUNT_COLUMN_ORDER = CONFIGURABLE_ACCOUNT_COLUMNS.map((c) => c.key)

// ACV hidden by default — preserves GET /api/accounts's original opt-in-only
// intent for this field (it's only ever returned with `?include=acv`)
// rather than silently making it a default-visible list column. See issue
// #9's decision log entry in design.md.
export const DEFAULT_ACCOUNT_COLUMN_VISIBILITY = { acv: false }

export function normalizeAccountColumnOrder(order) {
  return normalizeColumnOrder(order, DEFAULT_ACCOUNT_COLUMN_ORDER)
}

export function getVisibleOrderedAccountColumns(order, visibility) {
  return getVisibleOrderedColumns(order, visibility, CONFIGURABLE_ACCOUNT_COLUMNS, DEFAULT_ACCOUNT_COLUMN_ORDER)
}
