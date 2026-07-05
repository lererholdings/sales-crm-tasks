// Generic helpers shared by both the tasks and accounts column-preference
// setups (lib/columns.js and lib/accountColumns.js) — parametrized by each
// resource's own configurable-columns list and default order, rather than
// hardcoding one resource's config.

// Drops keys no longer configurable and appends any configurable column
// missing from a stored order (e.g. one added after the user last saved
// their preferences), so ColumnManager always has a complete, valid list.
export function normalizeColumnOrder(order, defaultOrder) {
  const known = new Set(defaultOrder)
  const valid = (order ?? []).filter((key) => known.has(key))
  const missing = defaultOrder.filter((key) => !valid.includes(key))
  return [...valid, ...missing]
}

export function getVisibleOrderedColumns(order, visibility, columns, defaultOrder) {
  return normalizeColumnOrder(order, defaultOrder)
    .map((key) => columns.find((c) => c.key === key))
    .filter((col) => col && visibility[col.key] !== false)
}
