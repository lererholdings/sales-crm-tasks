import { memo } from 'react'
import AssigneeChip from '../ui/AssigneeChip.jsx'
import PriorityBadge from '../ui/PriorityBadge.jsx'
import StatusPill from '../ui/StatusPill.jsx'
import NotesPreview from './NotesPreview.jsx'
import TaskNameCell from './TaskNameCell.jsx'

const IMMINENT_DAYS = 3
const SECONDARY_TEXT = 'text-[12px] text-text-secondary'
const SECONDARY_TEXT_COLUMNS = new Set(['type', 'next_action', 'last_updated'])

function formatEta(eta) {
  if (!eta) return { text: '—', urgent: false }
  const etaDate = new Date(eta)
  const diffDays = Math.ceil((etaDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const urgent = diffDays <= IMMINENT_DAYS
  const text = etaDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { text, urgent }
}

function renderCell(columnKey, task, eta) {
  switch (columnKey) {
    case 'type':
      return task.task_type ? `${task.task_type.category} · ${task.task_type.name}` : '—'
    case 'assignee':
      return <AssigneeChip user={task.assignee} />
    case 'next_action':
      return task.next_action || '—'
    case 'priority':
      return <PriorityBadge priority={task.priority} />
    case 'status':
      return <StatusPill status={task.status} />
    case 'eta':
      return eta.text
    case 'notes_preview':
      return <NotesPreview notes={task.notes} />
    case 'last_updated':
      return task.last_updated_by
        ? `${new Date(task.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${task.last_updated_by.display_name}`
        : '—'
    default:
      return null
  }
}

// columns: ordered array of visible column configs from lib/columns.js
// (task_name isn't included here — it's always the first, pinned cell).
//
// Memoized so an edit to one task (see hooks/useTasks.js's
// updateTaskInPlace) only re-renders that row, not every row in the table
// — relies on onOpen/onDuplicate/onDeleteRequest and `columns` being stable
// references (useCallback/useMemo upstream), since a new reference every
// render would defeat memo regardless of whether `task` itself changed.
function TaskRow({ task, columns, onOpen, onDuplicate, onDeleteRequest }) {
  const eta = formatEta(task.eta)

  return (
    <tr className="group cursor-pointer border-b border-border bg-bg-surface hover:bg-bg-raised" onClick={() => onOpen(task)}>
      <td className="px-3 py-2">
        <TaskNameCell task={task} onOpen={onOpen} onDuplicate={onDuplicate} onDeleteRequest={onDeleteRequest} />
      </td>
      {columns.map((col) => {
        const cellClass =
          col.key === 'eta'
            ? eta.urgent
              ? 'text-[12px] font-medium text-urgent'
              : SECONDARY_TEXT
            : SECONDARY_TEXT_COLUMNS.has(col.key)
              ? SECONDARY_TEXT
              : ''
        return (
          <td key={col.key} className={`px-3 py-2 ${cellClass}`}>
            {renderCell(col.key, task, eta)}
          </td>
        )
      })}
    </tr>
  )
}

export default memo(TaskRow)
