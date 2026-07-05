import { useEffect, useRef } from 'react'

export default function ContextMenu({ open, onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border-mid bg-bg-surface p-1 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function ContextMenuItem({ icon, label, onClick, accent = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-bg-raised ${accent ? 'text-accent' : 'text-text-primary'}`}
    >
      <i className={`ti ${icon} text-[15px] ${accent ? 'text-accent' : 'text-text-secondary'}`} />
      {label}
    </button>
  )
}

export function ContextMenuDivider() {
  return <hr className="my-1 border-border" />
}
