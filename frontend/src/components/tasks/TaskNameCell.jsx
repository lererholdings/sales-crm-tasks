import { useState } from 'react'
import ContextMenu, { ContextMenuDivider, ContextMenuItem } from '../ui/ContextMenu.jsx'

export default function TaskNameCell({ task, onOpen, onDuplicate, onDeleteRequest }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPartnerOnly = !task.account

  function closeAnd(fn) {
    return () => {
      setMenuOpen(false)
      fn(task)
    }
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="truncate text-[13px] font-medium text-accent hover:underline"
      >
        {task.task_name}
      </button>
      {task.deleted_at && <span className="text-[11px] font-normal text-text-muted">(deleted)</span>}
      <button
        type="button"
        aria-label="Task actions"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        className="ctx-trigger inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-border-mid text-text-secondary opacity-0 group-hover:opacity-100"
      >
        <i className="ti ti-dots text-[13px]" />
      </button>
      <ContextMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        {isPartnerOnly && (
          <>
            <ContextMenuItem icon="ti-link" label="Link to account" accent onClick={closeAnd(onOpen)} />
            <ContextMenuDivider />
          </>
        )}
        <ContextMenuItem icon="ti-edit" label="Edit task" onClick={closeAnd(onOpen)} />
        <ContextMenuItem icon="ti-copy" label="Duplicate" onClick={closeAnd(onDuplicate)} />
        <ContextMenuDivider />
        <ContextMenuItem icon="ti-trash" label="Delete task" onClick={closeAnd(onDeleteRequest)} />
      </ContextMenu>
    </div>
  )
}
