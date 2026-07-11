import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePreferences } from '../hooks/usePreferences.js'
import { useAccounts } from '../hooks/useAccounts.js'
import { useApiClient } from '../lib/apiClient.js'
import AccountTable from '../components/accounts/AccountTable.jsx'
import AccountToolbar from '../components/accounts/AccountToolbar.jsx'
import NewAccountModal from '../components/accounts/NewAccountModal.jsx'
import AccountSidePanel from '../components/accounts/AccountSidePanel.jsx'

export default function AccountsPage() {
  const [filters, setFilters] = useState({ sort_by: undefined, sort_dir: undefined })
  const { preferences, updatePreferences } = usePreferences()
  // ACV is opt-in on the API (?include=acv) — only request it once the
  // user has actually made the column visible, rather than always fetching
  // a field most views won't show.
  const includeAcv = preferences.accounts_column_visibility?.acv === true
  // Memoized: useAccounts's refresh depends on this object's identity (see
  // its docstring), so a fresh `{ ...filters, includeAcv }` literal every
  // render would refetch in a loop instead of only when filters/includeAcv
  // actually change.
  const accountsFilters = useMemo(() => ({ ...filters, includeAcv }), [filters, includeAcv])
  const { accounts, loading, error, refresh } = useAccounts(accountsFilters)
  const apiClient = useApiClient()
  const [showNewModal, setShowNewModal] = useState(false)
  // Deep-link entry point (e.g. "View account" from an audit log entry) —
  // one-directional like TasksPage's ?taskId=, not synced URL state.
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedAccountId, setSelectedAccountId] = useState(() => searchParams.get('accountId'))

  const handleCloseAccountPanel = useCallback(() => {
    setSelectedAccountId(null)
    if (searchParams.has('accountId')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('accountId')
          return next
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  const handleSort = useCallback((sortKey) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: sortKey,
      sort_dir: prev.sort_by === sortKey && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const handleCreate = async (payload) => {
    await apiClient.post('/accounts', payload)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <AccountToolbar
        filters={filters}
        onFilterChange={setFilters}
        preferences={preferences}
        onReorderColumns={(accounts_column_order) => updatePreferences({ accounts_column_order })}
        onToggleColumnVisibility={(accounts_column_visibility) => updatePreferences({ accounts_column_visibility })}
        onNewAccount={() => setShowNewModal(true)}
      />

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-6 text-sm text-text-secondary">Loading…</p>}
        {error && <p className="p-6 text-sm text-urgent">Failed to load accounts.</p>}
        {!loading && !error && (
          <AccountTable
            accounts={accounts}
            onSelectAccount={(account) => setSelectedAccountId(account.id)}
            columnOrder={preferences.accounts_column_order}
            columnVisibility={preferences.accounts_column_visibility}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir}
            onSort={handleSort}
          />
        )}
      </div>

      {showNewModal && <NewAccountModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />}

      <AccountSidePanel accountId={selectedAccountId} onClose={handleCloseAccountPanel} onUpdated={refresh} />
    </div>
  )
}
