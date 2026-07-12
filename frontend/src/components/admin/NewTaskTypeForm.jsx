import { useState } from 'react'
import { TASK_CATEGORIES } from '../../lib/constants.js'

export default function NewTaskTypeForm({ onCreate }) {
  const [category, setCategory] = useState(TASK_CATEGORIES[0])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) {
      setSubmitAttempted(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onCreate({ category, name: name.trim() })
      setName('')
      setSubmitAttempted(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-b border-border bg-bg-surface p-3">
      <div className="flex items-center gap-2">
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
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          <i className="ti ti-plus" /> Add
        </button>
      </div>
      {submitAttempted && !name.trim() && (
        <p className="mt-1.5 text-[11px] text-urgent">Name is required.</p>
      )}
      {error && <p className="mt-1.5 text-[12px] text-urgent">{error}</p>}
    </form>
  )
}
