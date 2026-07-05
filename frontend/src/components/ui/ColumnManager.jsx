import { useEffect, useRef, useState } from 'react'

// columns: this resource's CONFIGURABLE_* list (e.g. lib/columns.js's
// CONFIGURABLE_COLUMNS or lib/accountColumns.js's CONFIGURABLE_ACCOUNT_COLUMNS).
// normalizeOrder: the matching normalize*ColumnOrder function, so a stored
// order missing a newer column (or naming a removed one) still resolves to
// a complete, valid list.
//
// Drag state lives in this component (not the browser's DataTransfer API) —
// we never read/write e.dataTransfer, so there's nothing jsdom needs to
// support for the interaction to be testable with plain fireEvent calls.
export default function ColumnManager({ columns, normalizeOrder, columnOrder, columnVisibility, onReorder, onToggleVisibility }) {
  const [open, setOpen] = useState(false)
  const [dragKey, setDragKey] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const orderedKeys = normalizeOrder(columnOrder)
  const orderedColumns = orderedKeys.map((key) => columns.find((c) => c.key === key)).filter(Boolean)

  const handleDrop = (targetKey) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null)
      return
    }
    const withoutDragged = orderedKeys.filter((key) => key !== dragKey)
    const targetIndex = withoutDragged.indexOf(targetKey)
    const nextOrder = [...withoutDragged]
    nextOrder.splice(targetIndex, 0, dragKey)
    onReorder(nextOrder)
    setDragKey(null)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Manage columns"
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-bg-surface px-2.5 text-[12px] text-text-secondary"
      >
        <i className="ti ti-columns text-[13px]" /> Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-border-mid bg-bg-surface p-1 shadow-xl">
          {orderedColumns.map((col) => (
            <div
              key={col.key}
              role="listitem"
              aria-label={col.label}
              draggable
              onDragStart={() => setDragKey(col.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text-primary hover:bg-bg-raised"
            >
              <i className="ti ti-grip-vertical cursor-grab text-text-muted" />
              <input
                type="checkbox"
                id={`col-vis-${col.key}`}
                checked={columnVisibility[col.key] !== false}
                onChange={() =>
                  onToggleVisibility({ ...columnVisibility, [col.key]: columnVisibility[col.key] === false })
                }
                className="h-3.5 w-3.5"
              />
              <label htmlFor={`col-vis-${col.key}`} className="flex-1 cursor-pointer select-none">
                {col.label}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
