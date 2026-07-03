// Generic slide-in container — reused for accounts (this milestone) and
// tasks (later milestones), per design.md section 8.
export default function SidePanel({ open, onClose, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close panel" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-bg-surface shadow-xl">
        {children}
      </div>
    </div>
  )
}
