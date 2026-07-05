import { Fragment, useCallback, useMemo, useState } from 'react'
import { groupTasks } from '../../lib/groupTasks.js'
import { DEFAULT_COLUMN_ORDER, TASK_NAME_COLUMN, getVisibleOrderedColumns } from '../../lib/columns.js'
import TaskGroupHeader from './TaskGroupHeader.jsx'
import TaskRow from './TaskRow.jsx'

function SortableHeader({ column, sortBy, sortDir, onSort }) {
  const sortable = Boolean(column.sortKey)
  const active = sortable && sortBy === column.sortKey

  return (
    <th
      className={`px-3 py-2 ${sortable ? 'cursor-pointer select-none hover:text-text-primary' : ''}`}
      onClick={sortable ? () => onSort(column.sortKey) : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {column.label}
        {active && <i className={`ti ${sortDir === 'desc' ? 'ti-arrow-down' : 'ti-arrow-up'} text-[11px]`} />}
      </span>
    </th>
  )
}

export default function TaskTable({
  tasks,
  onOpen,
  onDuplicate,
  onDeleteRequest,
  columnOrder = DEFAULT_COLUMN_ORDER,
  columnVisibility = {},
  sortBy = null,
  sortDir = 'asc',
  onSort = () => {},
}) {
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

  // Kept referentially stable across unrelated re-renders (e.g. collapsing a
  // group) so it doesn't defeat TaskRow's React.memo the way a fresh array
  // every render would.
  const visibleColumns = useMemo(
    () => getVisibleOrderedColumns(columnOrder, columnVisibility),
    [columnOrder, columnVisibility],
  )

  if (tasks.length === 0) {
    return <p className="p-6 text-sm text-text-secondary">No tasks yet.</p>
  }

  const groups = groupTasks(tasks)
  const columnCount = visibleColumns.length + 1

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <SortableHeader column={TASK_NAME_COLUMN} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          {visibleColumns.map((col) => (
            <SortableHeader key={col.key} column={col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          ))}
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
                columnCount={columnCount}
                onToggle={toggleGroup}
              />
              {!collapsed &&
                group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    columns={visibleColumns}
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
