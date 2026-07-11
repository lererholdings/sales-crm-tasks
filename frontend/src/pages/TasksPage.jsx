import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePreferences } from '../hooks/usePreferences.js'
import { useTasks } from '../hooks/useTasks.js'
import { useApiClient } from '../lib/apiClient.js'
import { TASK_STATUSES } from '../lib/constants.js'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import NewTaskModal from '../components/tasks/NewTaskModal.jsx'
import TaskSidePanel from '../components/tasks/TaskSidePanel.jsx'
import TaskTable from '../components/tasks/TaskTable.jsx'
import TaskToolbar from '../components/tasks/TaskToolbar.jsx'

// Done tasks are hidden on first load — completed work isn't the thing
// you're triaging day to day. Still fully visible/toggleable via the
// Status filter chip, this only sets the starting selection.
const DEFAULT_STATUS_FILTER = TASK_STATUSES.filter((status) => status !== 'done')

export default function TasksPage() {
  const [filters, setFilters] = useState({ status: DEFAULT_STATUS_FILTER, sort_by: undefined, sort_dir: undefined })
  const { tasks, loading, error, refresh, updateTaskInPlace } = useTasks(filters)
  const { preferences, updatePreferences } = usePreferences()
  const apiClient = useApiClient()
  const [showNewModal, setShowNewModal] = useState(false)
  // Deep-link entry point (e.g. "View task" from an audit log entry) —
  // opens straight to that task on mount. One-directional: opening a task
  // from the table itself doesn't push a URL param, this is just an
  // entry point, not synced URL state.
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTaskId, setSelectedTaskId] = useState(() => searchParams.get('taskId'))
  const [taskPendingDelete, setTaskPendingDelete] = useState(null)

  const handleSort = useCallback((sortKey) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: sortKey,
      sort_dir: prev.sort_by === sortKey && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const handleCreate = async (payload) => {
    await apiClient.post('/tasks', payload)
    await refresh()
  }

  const handleDuplicate = useCallback(
    async (task) => {
      await apiClient.post('/tasks', {
        task_name: `${task.task_name} (copy)`,
        account_id: task.account?.id ?? undefined,
        partner_name: task.partner_name ?? undefined,
        distributor_name: task.distributor_name ?? undefined,
        task_type_id: task.task_type?.id,
        assignee_id: task.assignee?.id,
        next_action: task.next_action ?? undefined,
        eta: task.eta ?? undefined,
        priority: task.priority,
        status: task.status,
        sfdc_task_url: task.sfdc_task_url ?? undefined,
      })
      await refresh()
    },
    [apiClient, refresh],
  )

  const handleDeleteConfirmed = async () => {
    await apiClient.delete(`/tasks/${taskPendingDelete.id}`)
    if (selectedTaskId === taskPendingDelete.id) setSelectedTaskId(null)
    setTaskPendingDelete(null)
    await refresh()
  }

  // Stable references so TaskRow's React.memo can actually skip re-rendering
  // rows whose own task object didn't change (see hooks/useTasks.js).
  const handleOpen = useCallback((task) => setSelectedTaskId(task.id), [])
  const handleDeleteRequest = useCallback((task) => setTaskPendingDelete(task), [])
  const handleClosePanel = useCallback(() => {
    setSelectedTaskId(null)
    if (searchParams.has('taskId')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('taskId')
          return next
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)

  return (
    <div className="flex h-full flex-col">
      <TaskToolbar
        filters={filters}
        onFilterChange={setFilters}
        preferences={preferences}
        onReorderColumns={(column_order) => updatePreferences({ column_order })}
        onToggleColumnVisibility={(column_visibility) => updatePreferences({ column_visibility })}
        onNewTask={() => setShowNewModal(true)}
      />

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-6 text-sm text-text-secondary">Loading…</p>}
        {error && <p className="p-6 text-sm text-urgent">Failed to load tasks.</p>}
        {!loading && !error && (
          <TaskTable
            tasks={tasks}
            onOpen={handleOpen}
            onDuplicate={handleDuplicate}
            onDeleteRequest={handleDeleteRequest}
            columnOrder={preferences.column_order}
            columnVisibility={preferences.column_visibility}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir}
            onSort={handleSort}
          />
        )}
      </div>

      {showNewModal && (
        <NewTaskModal tasks={tasks} onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      )}

      <TaskSidePanel
        taskId={selectedTaskId}
        notesPreviewCount={selectedTask?.notes?.length || 2}
        onClose={handleClosePanel}
        onUpdated={(updated) => updateTaskInPlace(updated.id, updated)}
        onNotesChanged={(taskId, notesPreview) => updateTaskInPlace(taskId, { notes: notesPreview })}
      />

      <ConfirmDialog
        open={Boolean(taskPendingDelete)}
        title="Delete this task?"
        message={
          taskPendingDelete
            ? `"${taskPendingDelete.task_name}" and its notes will be hidden from view. This can only be undone by an admin.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setTaskPendingDelete(null)}
      />
    </div>
  )
}
