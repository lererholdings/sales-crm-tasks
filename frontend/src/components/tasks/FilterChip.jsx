import { useEffect, useRef, useState } from 'react'
import { CHIP_ACTIVE_CLASSES, CHIP_IDLE_CLASSES } from '../../lib/chipStyles.js'

// Three modes, matching what GET /api/tasks accepts per param:
// - 'select' (default): exact-match filter (assignee_id, task_type_id) —
//   dropdown list of options, single choice, closes on pick, "Clear" entry.
// - 'multi': status/priority accept a comma-separated list matched with
//   `IN (...)` server-side — checkboxes, dropdown stays open across picks,
//   "Clear all" entry. `value` is an array; `onChange` receives the next
//   array (never null — an empty array means "no filter").
// - 'text': substring filter (partner_name is matched with ILIKE on the
//   server) — a small debounced text input instead of a fixed option list.
export default function FilterChip({ icon, label, options = [], value, onChange, mode = 'select' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [text, setText] = useState(value ?? '')
  const ref = useRef(null)

  useEffect(() => {
    if (mode === 'text') setText(value ?? '')
  }, [mode, value])

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  // Debounced so typing a partner name doesn't fire a request per keystroke.
  useEffect(() => {
    if (mode !== 'text' || !open) return undefined
    const trimmed = text.trim()
    if (trimmed === (value ?? '')) return undefined
    const timer = setTimeout(() => onChange(trimmed || null), 300)
    return () => clearTimeout(timer)
  }, [mode, open, text, value, onChange])

  const selected = mode === 'select' ? options.find((o) => o.value === value) : null
  // A multi-select chip only reads as "actively filtering" when it excludes
  // at least one option — 0 selected or all selected both mean "no real
  // filter applied," same as the idle state for the other modes.
  const isPartialMultiSelect = mode === 'multi' && value.length > 0 && value.length < options.length
  const active = mode === 'select' ? Boolean(selected) : mode === 'multi' ? isPartialMultiSelect : Boolean(value)
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  const chipLabel =
    mode === 'select' ? (selected?.label ?? label) : mode === 'multi' ? (isPartialMultiSelect ? `${label} (${value.length})` : label) : value || label

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12px] ${active ? CHIP_ACTIVE_CLASSES : CHIP_IDLE_CLASSES}`}
      >
        {icon && <i className={`ti ${icon} text-[13px]`} />}
        {chipLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-52 rounded-lg border border-border-mid bg-bg-surface shadow-xl">
          {mode === 'text' ? (
            <div className="flex items-center gap-1.5 p-1.5">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Filter by ${label.toLowerCase()}…`}
                className="w-full rounded-md border border-border bg-bg-input px-2 py-1 text-[13px] text-text-primary outline-none"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    setText('')
                    onChange(null)
                    setOpen(false)
                  }}
                  aria-label={`Clear ${label} filter`}
                  className="rounded-md p-1 text-text-muted hover:bg-bg-raised"
                >
                  <i className="ti ti-x text-[13px]" />
                </button>
              )}
            </div>
          ) : mode === 'multi' ? (
            <div className="max-h-48 overflow-auto p-1">
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-text-secondary hover:bg-bg-raised"
                >
                  Clear all
                </button>
              )}
              {options.map((option) => {
                const checked = value.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-text-primary hover:bg-bg-raised"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(checked ? value.filter((v) => v !== option.value) : [...value, option.value])}
                      className="h-3.5 w-3.5"
                    />
                    {option.label}
                  </label>
                )
              })}
            </div>
          ) : (
            <>
              {options.length > 6 && (
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full border-b border-border px-3 py-1.5 text-[13px] text-text-primary outline-none"
                />
              )}
              <div className="max-h-48 overflow-auto p-1">
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-text-secondary hover:bg-bg-raised"
                  >
                    Clear
                  </button>
                )}
                {filtered.length === 0 && <p className="px-2.5 py-1.5 text-[12px] text-text-muted">No matches</p>}
                {filtered.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-bg-raised ${
                      option.value === value ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
