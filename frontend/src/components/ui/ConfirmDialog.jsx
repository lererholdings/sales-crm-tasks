export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-5 shadow-xl">
        <h2 className="mb-2 text-[15px] font-medium text-text-primary">{title}</h2>
        {message && <p className="mb-4 text-[13px] text-text-secondary">{message}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-raised"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium text-white ${danger ? 'bg-urgent' : 'bg-accent-strong'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
