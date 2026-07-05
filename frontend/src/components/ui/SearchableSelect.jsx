import { useEffect, useRef, useState } from 'react'

// options: [{ value, label, archived? }] — archived options render greyed
// out with an "(archived)" suffix but remain selectable (issue #5: archived
// accounts stay pickable, just visually de-emphasized). Callers that want
// them sorted last should already order the `options` array that way.
export default function SearchableSelect({ options, value, onChange, placeholder = 'Select…', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const selected = options.find((o) => o.value === value)
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-3 py-1.5 text-left text-[13px] text-text-primary disabled:opacity-50"
      >
        <span className={!selected ? 'text-text-muted' : selected.archived ? 'text-text-muted' : ''}>
          {selected ? `${selected.label}${selected.archived ? ' (archived)' : ''}` : placeholder}
        </span>
        <i className="ti ti-chevron-down text-text-secondary" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border-mid bg-bg-surface shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter…"
            className="w-full border-b border-border px-3 py-1.5 text-[13px] text-text-primary outline-none"
          />
          <div className="max-h-48 overflow-auto p-1">
            {filtered.length === 0 && <p className="px-2 py-1.5 text-[12px] text-text-muted">No matches</p>}
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
                  option.archived ? 'text-text-muted' : option.value === value ? 'text-accent' : 'text-text-primary'
                }`}
              >
                {option.label}
                {option.archived ? ' (archived)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
