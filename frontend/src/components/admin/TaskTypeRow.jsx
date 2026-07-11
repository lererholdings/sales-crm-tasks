import { useState } from 'react'

export default function TaskTypeRow({ taskType, onRename, onToggleActive }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(taskType.name)

  const saveRename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== taskType.name) onRename(taskType.id, trimmed)
    else setName(taskType.name)
    setEditing(false)
  }

  return (
    <tr className={`border-b border-border ${taskType.active ? '' : 'opacity-60'}`}>
      <td className="px-3 py-2">
        <span className="rounded-full bg-bg-raised px-2 py-0.5 text-[11px] text-text-secondary">
          {taskType.category}
        </span>
      </td>
      <td className="px-3 py-2 text-[13px]">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename()
              if (e.key === 'Escape') {
                setName(taskType.name)
                setEditing(false)
              }
            }}
            className="rounded-md border border-border bg-bg-input px-2 py-1 text-[13px] text-text-primary"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left text-text-primary hover:underline"
          >
            {taskType.name}
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
          <input
            type="checkbox"
            checked={taskType.active}
            onChange={() => onToggleActive(taskType.id, !taskType.active)}
            className="h-3.5 w-3.5"
          />
          {taskType.active ? 'Active' : 'Inactive'}
        </label>
      </td>
    </tr>
  )
}
