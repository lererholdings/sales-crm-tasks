import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import { useUsers } from '../../hooks/useUsers.js'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants.js'
import ColumnManager from './ColumnManager.jsx'
import FilterChip from './FilterChip.jsx'
import SearchInput from './SearchInput.jsx'
import ShowDeletedToggle from './ShowDeletedToggle.jsx'

const STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))

export default function TaskToolbar({ filters, onFilterChange, preferences, onReorderColumns, onToggleColumnVisibility, onNewTask }) {
  const { users } = useUsers()
  const { taskTypes } = useTaskTypes()
  const { user: currentUser } = useCurrentUser()

  const assigneeOptions = users.map((u) => ({ value: u.id, label: u.display_name }))
  const typeOptions = taskTypes.map((t) => ({ value: t.id, label: `${t.category} · ${t.name}` }))

  const setFilter = (key) => (value) => onFilterChange({ ...filters, [key]: value ?? undefined })

  return (
    <div className="flex items-center gap-2 border-b border-border bg-bg-surface p-3">
      <SearchInput value={filters.search} onChange={setFilter('search')} />
      <FilterChip icon="ti-filter" label="Status" options={STATUS_OPTIONS} value={filters.status} onChange={setFilter('status')} />
      <FilterChip icon="ti-user" label="Assignee" options={assigneeOptions} value={filters.assignee_id} onChange={setFilter('assignee_id')} />
      <FilterChip icon="ti-flag" label="Priority" options={PRIORITY_OPTIONS} value={filters.priority} onChange={setFilter('priority')} />
      <FilterChip icon="ti-tag" label="Type" options={typeOptions} value={filters.task_type_id} onChange={setFilter('task_type_id')} />
      <FilterChip icon="ti-building" label="Partner" mode="text" value={filters.partner_name} onChange={setFilter('partner_name')} />
      {currentUser?.role === 'admin' && (
        <ShowDeletedToggle active={Boolean(filters.include_deleted)} onToggle={(value) => setFilter('include_deleted')(value || undefined)} />
      )}
      <ColumnManager
        columnOrder={preferences.column_order}
        columnVisibility={preferences.column_visibility}
        onReorder={onReorderColumns}
        onToggleVisibility={onToggleColumnVisibility}
      />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onNewTask}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white"
      >
        <i className="ti ti-plus" /> New task
      </button>
    </div>
  )
}
