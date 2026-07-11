export default function AuditPagination({ offset, limit, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const page = Math.floor(offset / limit) + 1
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const goToPage = (p) => onPageChange((p - 1) * limit)

  return (
    <div className="flex items-center justify-between border-t border-border bg-bg-surface px-3 py-2 text-[12px] text-text-secondary">
      <span>{total} {total === 1 ? 'entry' : 'entries'}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => goToPage(1)}
          aria-label="Jump to first page"
          className="rounded-lg border border-border px-2 py-1 disabled:opacity-40"
        >
          <i className="ti ti-chevrons-left" />
        </button>
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => goToPage(page - 1)}
          className="rounded-lg border border-border px-2.5 py-1 disabled:opacity-40"
        >
          <i className="ti ti-chevron-left" /> Prev
        </button>
        <select
          value={page}
          onChange={(e) => goToPage(Number(e.target.value))}
          aria-label="Jump to page"
          className="rounded-lg border border-border bg-bg-input px-2 py-1 text-text-primary"
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>
              Page {p} of {totalPages}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => goToPage(page + 1)}
          className="rounded-lg border border-border px-2.5 py-1 disabled:opacity-40"
        >
          Next <i className="ti ti-chevron-right" />
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => goToPage(totalPages)}
          aria-label="Jump to last page"
          className="rounded-lg border border-border px-2 py-1 disabled:opacity-40"
        >
          <i className="ti ti-chevrons-right" />
        </button>
      </div>
    </div>
  )
}
