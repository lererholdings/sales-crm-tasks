export default function AuditPagination({ offset, limit, resultCount, onPageChange }) {
  const hasPrev = offset > 0
  const hasNext = resultCount === limit // a full page came back, there may be more
  const page = Math.floor(offset / limit) + 1

  return (
    <div className="flex items-center justify-between border-t border-border bg-bg-surface px-3 py-2 text-[12px] text-text-secondary">
      <span>Page {page}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="rounded-lg border border-border px-2.5 py-1 disabled:opacity-40"
        >
          <i className="ti ti-chevron-left" /> Prev
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => onPageChange(offset + limit)}
          className="rounded-lg border border-border px-2.5 py-1 disabled:opacity-40"
        >
          Next <i className="ti ti-chevron-right" />
        </button>
      </div>
    </div>
  )
}
