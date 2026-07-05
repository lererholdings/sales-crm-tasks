export default function LoadMoreButton({ remaining, onClick, loading }) {
  if (remaining <= 0) return null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mb-3 w-full rounded-lg border border-border-mid py-1.5 text-[12px] text-text-secondary hover:bg-bg-raised disabled:opacity-50"
    >
      {loading ? 'Loading…' : `Load ${Math.min(remaining, 25)} more note${remaining === 1 ? '' : 's'}`}
    </button>
  )
}
