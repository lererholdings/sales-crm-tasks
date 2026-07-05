import { memo } from 'react'
import AssigneeChip from '../ui/AssigneeChip.jsx'
import PriorityBadge from '../ui/PriorityBadge.jsx'
import StatusPill from '../ui/StatusPill.jsx'
import NotesPreview from './NotesPreview.jsx'
import TaskNameCell from './TaskNameCell.jsx'

const IMMINENT_DAYS = 3

function formatEta(eta) {
  if (!eta) return { text: '—', urgent: false }
  const etaDate = new Date(eta)
  const diffDays = Math.ceil((etaDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const urgent = diffDays <= IMMINENT_DAYS
  const text = etaDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { text, urgent }
}

// Memoized so an edit to one task (see hooks/useTasks.js's
// updateTaskInPlace) only re-renders that row, not every row in the table
// — relies on onOpen/onDuplicate/onDeleteRequest being stable references
// (useCallback in TasksPage.jsx), since a new function reference every
// render would defeat memo regardless of whether `task` itself changed.
function TaskRow({ task, onOpen, onDuplicate, onDeleteRequest }) {
  const eta = formatEta(task.eta)

  return (
    <tr className="group cursor-pointer border-b border-border bg-bg-surface hover:bg-bg-raised" onClick={() => onOpen(task)}>
      <td className="px-3 py-2">
        <TaskNameCell task={task} onOpen={onOpen} onDuplicate={onDuplicate} onDeleteRequest={onDeleteRequest} />
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {task.task_type ? `${task.task_type.category} · ${task.task_type.name}` : '—'}
      </td>
      <td className="px-3 py-2">
        <AssigneeChip user={task.assignee} />
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">{task.next_action || '—'}</td>
      <td className="px-3 py-2">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className="px-3 py-2">
        <StatusPill status={task.status} />
      </td>
      <td className={`px-3 py-2 text-[12px] ${eta.urgent ? 'font-medium text-urgent' : 'text-text-secondary'}`}>
        {eta.text}
      </td>
      <td className="px-3 py-2">
        <NotesPreview notes={task.notes} />
      </td>
    </tr>
  )
}

export default memo(TaskRow)
