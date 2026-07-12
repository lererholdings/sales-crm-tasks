import { useState } from 'react'
import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import NewTaskTypeForm from './NewTaskTypeForm.jsx'
import TaskTypeList from './TaskTypeList.jsx'

export default function TaskTypesPanel() {
  const { taskTypes, loading, error, createTaskType, updateTaskType } = useTaskTypes()
  const [mutationError, setMutationError] = useState(null)

  const handleCreate = async (payload) => {
    await createTaskType(payload)
  }

  const handleRename = async (id, name) => {
    setMutationError(null)
    try {
      await updateTaskType(id, { name })
    } catch (err) {
      setMutationError(err.message)
    }
  }

  const handleToggleActive = async (id, active) => {
    setMutationError(null)
    try {
      await updateTaskType(id, { active })
    } catch (err) {
      setMutationError(err.message)
    }
  }

  return (
    <div>
      <NewTaskTypeForm onCreate={handleCreate} />
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-urgent">Failed to load task types.</p>}
      {mutationError && <p className="p-4 text-sm text-urgent">{mutationError}</p>}
      {!loading && !error && (
        <TaskTypeList taskTypes={taskTypes} onRename={handleRename} onToggleActive={handleToggleActive} />
      )}
    </div>
  )
}
