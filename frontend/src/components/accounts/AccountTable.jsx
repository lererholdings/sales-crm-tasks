import { useMemo } from 'react'
import {
  ACCOUNT_NAME_COLUMN,
  DEFAULT_ACCOUNT_COLUMN_ORDER,
  DEFAULT_ACCOUNT_COLUMN_VISIBILITY,
  getVisibleOrderedAccountColumns,
} from '../../lib/accountColumns.js'
import AccountRow from './AccountRow.jsx'

function SortableHeader({ column, sortBy, sortDir, onSort }) {
  const sortable = Boolean(column.sortKey)
  const active = sortable && sortBy === column.sortKey

  return (
    <th
      className={`px-3 py-2 ${sortable ? 'cursor-pointer select-none hover:text-text-primary' : ''}`}
      onClick={sortable ? () => onSort(column.sortKey) : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {column.label}
        {active && <i className={`ti ${sortDir === 'desc' ? 'ti-arrow-down' : 'ti-arrow-up'} text-[11px]`} />}
      </span>
    </th>
  )
}

export default function AccountTable({
  accounts,
  onSelectAccount,
  columnOrder = DEFAULT_ACCOUNT_COLUMN_ORDER,
  columnVisibility = DEFAULT_ACCOUNT_COLUMN_VISIBILITY,
  sortBy = null,
  sortDir = 'asc',
  onSort = () => {},
}) {
  const visibleColumns = useMemo(
    () => getVisibleOrderedAccountColumns(columnOrder, columnVisibility),
    [columnOrder, columnVisibility],
  )

  if (accounts.length === 0) {
    return <p className="p-6 text-sm text-text-secondary">No accounts yet.</p>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <SortableHeader column={ACCOUNT_NAME_COLUMN} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          {visibleColumns.map((col) => (
            <SortableHeader key={col.key} column={col} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
          ))}
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} columns={visibleColumns} onClick={onSelectAccount} />
        ))}
      </tbody>
    </table>
  )
}
