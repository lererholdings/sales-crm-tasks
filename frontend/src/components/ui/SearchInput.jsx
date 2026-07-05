import { useEffect, useState } from 'react'

const DEBOUNCE_MS = 300

// Debounced so free text search fires one request after the user pauses
// typing, not one per keystroke. `value` stays externally controlled by the
// caller (e.g. TasksPage/AccountsPage's filters.search) — this only delays
// when onChange fires.
export default function SearchInput({ value, onChange, placeholder = 'Search tasks, accounts, notes…' }) {
  const [text, setText] = useState(value ?? '')

  useEffect(() => {
    setText(value ?? '')
  }, [value])

  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === (value ?? '')) return undefined
    const timer = setTimeout(() => onChange(trimmed || null), DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <div className="flex h-8 max-w-[220px] flex-1 items-center gap-1.5 rounded-lg border border-border bg-bg-input px-2.5">
      <i className="ti ti-search text-[15px] text-text-muted" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] text-text-primary outline-none"
      />
    </div>
  )
}
