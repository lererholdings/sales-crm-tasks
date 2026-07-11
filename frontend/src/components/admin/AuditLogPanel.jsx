import { useMemo, useState } from 'react'
import { useAuditLog } from '../../hooks/useAuditLog.js'
import AuditFilterBar from './AuditFilterBar.jsx'
import AuditPagination from './AuditPagination.jsx'
import AuditTable from './AuditTable.jsx'

const LIMIT = 100

export default function AuditLogPanel() {
  const [filters, setFilters] = useState({ offset: 0 })
  // Memoized so useAuditLog's refresh only changes identity when a filter
  // actually changes — see useTasks.js for why an inline object literal
  // here would cause a refetch loop instead.
  const queryFilters = useMemo(() => ({ ...filters, limit: LIMIT }), [filters])
  const { entries, total, loading, error } = useAuditLog(queryFilters)

  return (
    <div>
      <AuditFilterBar filters={filters} onFilterChange={setFilters} />
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-urgent">Failed to load audit log.</p>}
      {!loading && !error && (
        <>
          <AuditTable entries={entries} />
          <AuditPagination
            offset={filters.offset}
            limit={LIMIT}
            total={total}
            onPageChange={(offset) => setFilters((prev) => ({ ...prev, offset }))}
          />
        </>
      )}
    </div>
  )
}
