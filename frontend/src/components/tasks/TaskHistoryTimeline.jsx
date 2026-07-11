import { useState } from 'react'
import { AUDIT_ACTION_TEXT_CLASS, formatAuditValue } from '../../lib/auditFormat.js'

// Collapsed by default — this is secondary/audit-oriented info, not the
// first thing someone opening a task wants to see (that's Notes). The count
// still shows in the collapsed header so it's discoverable without opening it.
export default function TaskHistoryTimeline({ entries, total, loading, onLoadMore }) {
  const [expanded, setExpanded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const remaining = total - entries.length

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wide text-text-muted"
      >
        <span>History{total > 0 ? ` (${total})` : ''}</span>
        <i className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
      </button>

      {expanded && (
        <div className="mt-3 max-h-72 overflow-y-auto border-t border-border pt-3">
          {loading && <p className="text-[12px] text-text-muted">Loading…</p>}
          {!loading && entries.length === 0 && <p className="text-[12px] text-text-muted">No history yet.</p>}
          <ul>
            {entries.map((entry) => (
              <li key={entry.id} className="mb-3 text-[12px]">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <span>·</span>
                  <span>{entry.user?.display_name ?? '—'}</span>
                  <span className={`font-medium ${AUDIT_ACTION_TEXT_CLASS[entry.action] ?? 'text-text-secondary'}`}>
                    {entry.action}
                  </span>
                </div>
                {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
                  <ul className="mt-1 text-text-secondary">
                    {Object.entries(entry.changed_fields).map(([field, change]) => (
                      <li key={field}>
                        <span className="font-medium text-text-primary">{field}</span>:{' '}
                        {formatAuditValue(change.from)} → {formatAuditValue(change.to)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mb-1 w-full rounded-lg border border-border-mid py-1.5 text-[12px] text-text-secondary hover:bg-bg-raised disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : `Load ${Math.min(remaining, 20)} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
