import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import NewTaskTypeForm from './NewTaskTypeForm.jsx'
import TaskTypeList from './TaskTypeList.jsx'

export default function TaskTypesPanel() {
  const { taskTypes, loading, error, createTaskType, updateTaskType } = useTaskTypes()

  const handleCreate = async (payload) => {
    await createTaskType(payload)
  }

  const handleRename = async (id, name) => {
    await updateTaskType(id, { name })
  }

  const handleToggleActive = async (id, active) => {
    await updateTaskType(id, { active })
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
