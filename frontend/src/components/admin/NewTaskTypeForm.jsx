import { useState } from 'react'
import { TASK_CATEGORIES } from '../../lib/constants.js'

export default function NewTaskTypeForm({ onCreate }) {
  const [category, setCategory] = useState(TASK_CATEGORIES[0])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ category, name: name.trim() })
      setName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b border-border bg-bg-surface p-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border border-border bg-bg-input px-2.5 py-1.5 text-[13px] text-text-primary"
      >
        {TASK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New task type name…"
        className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
      />
      <button
        type="submit"
        disabled={!name.trim() || saving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        <i className="ti ti-plus" /> Add
      </button>
    </form>
  )
}
