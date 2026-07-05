import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// options: [{ value, label, archived? }] — archived options render greyed
// out with an "(archived)" suffix but remain selectable (issue #5: archived
// accounts stay pickable, just visually de-emphasized). Callers that want
// them sorted last should already order the `options` array that way.
//
// The dropdown is rendered via a portal into document.body, positioned with
// `fixed` coordinates from the trigger's own bounding rect, rather than as a
// normal absolutely-positioned child. A plain absolute child still
// contributes to its scrollable ancestor's scrollHeight — inside a modal
// with overflow-y-auto (like NewTaskModal), that made the last field's
// dropdown silently grow the modal and force a scroll instead of floating
// on top of it. Closes on scroll that would invalidate its position
// (the page itself, or a scrollable ancestor of the trigger) rather than
// repositioning, since these are short-lived popovers — but NOT on scroll
// of unrelated containers elsewhere on the page (e.g. a long notes list),
// which used to close the dropdown just because something else scrolled.
//
// Rough height of the dropdown (filter input + up to max-h-48 option list +
// borders) — used to decide whether there's enough room below the trigger
// before opening downward. We can't measure the real height ahead of the
// portal's first paint, and re-measuring after paint would cause a visible
// jump, so an estimate that's a bit generous is the simpler tradeoff.
const ESTIMATED_DROPDOWN_HEIGHT = 240

export default function SearchableSelect({ options, value, onChange, placeholder = 'Select…', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const openDropdown = () => {
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    // Anchoring with `bottom` instead of `top` when flipped means the
    // dropdown grows upward from the trigger without needing to know its
    // exact rendered height in advance.
    const openUpward = spaceBelow < ESTIMATED_DROPDOWN_HEIGHT && rect.top > spaceBelow
    setPosition({
      left: rect.left,
      width: rect.width,
      ...(openUpward ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }),
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (buttonRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function handleScroll(e) {
      const scrolledEl = e.target
      // Scrolling the dropdown's own option list is normal interaction, not
      // something that should close it.
      if (dropdownRef.current?.contains(scrolledEl)) return
      const isPageScroll = scrolledEl === document || scrolledEl === window
      const scrollsTrigger = typeof scrolledEl.contains === 'function' && scrolledEl.contains(buttonRef.current)
      if (isPageScroll || scrollsTrigger) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-3 py-1.5 text-left text-[13px] text-text-primary disabled:opacity-50"
      >
        <span className={!selected ? 'text-text-muted' : selected.archived ? 'text-text-muted' : ''}>
          {selected ? `${selected.label}${selected.archived ? ' (archived)' : ''}` : placeholder}
        </span>
        <i className="ti ti-chevron-down text-text-secondary" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              left: position.left,
              width: position.width,
              ...(position.bottom !== undefined ? { bottom: position.bottom } : { top: position.top }),
            }}
            className={`z-50 rounded-lg border border-border-mid bg-bg-surface shadow-xl ${position.bottom !== undefined ? 'mb-1' : 'mt-1'}`}
          >
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
                  {option.archived && <span> (archived)</span>}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
