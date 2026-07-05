import { Fragment, useCallback, useState } from 'react'
import { groupTasks } from '../../lib/groupTasks.js'
import TaskGroupHeader from './TaskGroupHeader.jsx'
import TaskRow from './TaskRow.jsx'

export default function TaskTable({ tasks, onOpen, onDuplicate, onDeleteRequest }) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())

  // Stable across renders (unlike an inline `() => toggleGroup(group.key)`
  // per group) so TaskGroupHeader's React.memo can actually take effect —
  // it calls onToggle(groupKey) itself instead of receiving a pre-bound
  // closure that would be a new function reference every render.
  const toggleGroup = useCallback((key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (tasks.length === 0) {
    return <p className="p-6 text-sm text-text-secondary">No tasks yet.</p>
  }

  const groups = groupTasks(tasks)

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <th className="px-3 py-2">Task</th>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Assignee</th>
          <th className="px-3 py-2">Next action</th>
          <th className="px-3 py-2">Priority</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">ETA</th>
          <th className="px-3 py-2">Notes</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.key)
          return (
            <Fragment key={group.key}>
              <TaskGroupHeader
                groupKey={group.key}
                label={group.label}
                isPartnerOnly={group.isPartnerOnly}
                count={group.tasks.length}
                collapsed={collapsed}
                onToggle={toggleGroup}
              />
              {!collapsed &&
                group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={onOpen}
                    onDuplicate={onDuplicate}
                    onDeleteRequest={onDeleteRequest}
                  />
                ))}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
