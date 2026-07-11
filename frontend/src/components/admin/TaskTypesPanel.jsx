import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import { useApiClient } from '../../lib/apiClient.js'
import NewTaskTypeForm from './NewTaskTypeForm.jsx'
import TaskTypeList from './TaskTypeList.jsx'

export default function TaskTypesPanel() {
  const { taskTypes, loading, error, refresh } = useTaskTypes()
  const apiClient = useApiClient()

  const handleCreate = async (payload) => {
    await apiClient.post('/task-types', payload)
    await refresh()
  }

  const handleRename = async (id, name) => {
    await apiClient.patch(`/task-types?id=${id}`, { name })
    await refresh()
  }

  const handleToggleActive = async (id, active) => {
    await apiClient.patch(`/task-types?id=${id}`, { active })
    await refresh()
  }

  return (
    <div>
      <NewTaskTypeForm onCreate={handleCreate} />
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-urgent">Failed to load task types.</p>}
      {!loading && !error && (
        <TaskTypeList taskTypes={taskTypes} onRename={handleRename} onToggleActive={handleToggleActive} />
      )}
    </div>
  )
}
