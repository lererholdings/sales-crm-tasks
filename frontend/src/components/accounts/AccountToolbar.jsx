import { CONFIGURABLE_ACCOUNT_COLUMNS, normalizeAccountColumnOrder } from '../../lib/accountColumns.js'
import ColumnManager from '../ui/ColumnManager.jsx'
import FilterChip from '../ui/FilterChip.jsx'
import SearchInput from '../ui/SearchInput.jsx'

export default function AccountToolbar({ filters, onFilterChange, preferences, onReorderColumns, onToggleColumnVisibility, onNewAccount }) {
  const setFilter = (key) => (value) => onFilterChange({ ...filters, [key]: value ?? undefined })

  return (
    <div className="flex items-center gap-2 border-b border-border bg-bg-surface p-3">
      <SearchInput value={filters.search} onChange={setFilter('search')} placeholder="Search accounts…" />
      <FilterChip icon="ti-map-pin" label="Country" mode="text" value={filters.country} onChange={setFilter('country')} />
      <ColumnManager
        columns={CONFIGURABLE_ACCOUNT_COLUMNS}
        normalizeOrder={normalizeAccountColumnOrder}
        columnOrder={preferences.accounts_column_order}
        columnVisibility={preferences.accounts_column_visibility}
        onReorder={onReorderColumns}
        onToggleVisibility={onToggleColumnVisibility}
      />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onNewAccount}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white"
      >
        <i className="ti ti-plus" /> New account
      </button>
    </div>
  )
}
