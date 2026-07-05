import { useState } from 'react'
import { useTasks } from '../hooks/useTasks.js'
import { useApiClient } from '../lib/apiClient.js'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import NewTaskModal from '../components/tasks/NewTaskModal.jsx'
import TaskSidePanel from '../components/tasks/TaskSidePanel.jsx'
import TaskTable from '../components/tasks/TaskTable.jsx'

export default function TasksPage() {
  const { tasks, loading, error, refresh } = useTasks()
  const apiClient = useApiClient()
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [taskPendingDelete, setTaskPendingDelete] = useState(null)

  const handleCreate = async (payload) => {
    await apiClient.post('/tasks', payload)
    await refresh()
  }

  const handleDuplicate = async (task) => {
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
  }

  const handleDeleteConfirmed = async () => {
    await apiClient.delete(`/tasks/${taskPendingDelete.id}`)
    if (selectedTaskId === taskPendingDelete.id) setSelectedTaskId(null)
    setTaskPendingDelete(null)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-bg-surface p-3">
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white"
        >
          <i className="ti ti-plus" /> New task
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-6 text-sm text-text-secondary">Loading…</p>}
        {error && <p className="p-6 text-sm text-urgent">Failed to load tasks.</p>}
        {!loading && !error && (
          <TaskTable
            tasks={tasks}
            onOpen={(task) => setSelectedTaskId(task.id)}
            onDuplicate={handleDuplicate}
            onDeleteRequest={(task) => setTaskPendingDelete(task)}
          />
        )}
      </div>

      {showNewModal && (
        <NewTaskModal tasks={tasks} onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      )}

      <TaskSidePanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onUpdated={refresh} />

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
