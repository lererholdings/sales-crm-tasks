import { useEffect, useRef, useState } from 'react'

const activeClasses = 'border-chip-active-border bg-chip-active-bg text-chip-active-text'
const idleClasses = 'border-border bg-bg-surface text-text-secondary'

// Two modes, matching what GET /api/tasks accepts per param:
// - 'select' (default): exact-match filter (status, assignee_id, priority,
//   task_type_id) — dropdown list of options, single choice, "Clear" entry.
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
  const active = mode === 'select' ? Boolean(selected) : Boolean(value)
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12px] ${active ? activeClasses : idleClasses}`}
      >
        {icon && <i className={`ti ${icon} text-[13px]`} />}
        {mode === 'select' ? selected?.label ?? label : value || label}
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
