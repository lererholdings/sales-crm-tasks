import TaskTypeRow from './TaskTypeRow.jsx'

export default function TaskTypeList({ taskTypes, onRename, onToggleActive }) {
  if (taskTypes.length === 0) {
    return <p className="p-4 text-sm text-text-secondary">No task types yet.</p>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <th className="px-3 py-2">Category</th>
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {taskTypes.map((taskType) => (
          <TaskTypeRow key={taskType.id} taskType={taskType} onRename={onRename} onToggleActive={onToggleActive} />
        ))}
      </tbody>
    </table>
  )
}
