import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts.js'
import { useApiClient } from '../lib/apiClient.js'
import AccountTable from '../components/accounts/AccountTable.jsx'
import NewAccountModal from '../components/accounts/NewAccountModal.jsx'
import AccountSidePanel from '../components/accounts/AccountSidePanel.jsx'

export default function AccountsPage() {
  const [search, setSearch] = useState('')
  const { accounts, loading, error, refresh } = useAccounts({ search })
  const apiClient = useApiClient()
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState(null)

  const handleCreate = async (payload) => {
    await apiClient.post('/accounts', payload)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-bg-surface p-3">
        <input
          type="text"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white"
        >
          <i className="ti ti-plus" /> New account
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-6 text-sm text-text-secondary">Loading…</p>}
        {error && <p className="p-6 text-sm text-urgent">Failed to load accounts.</p>}
        {!loading && !error && (
          <AccountTable accounts={accounts} onSelectAccount={(account) => setSelectedAccountId(account.id)} />
        )}
      </div>

      {showNewModal && <NewAccountModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />}

      <AccountSidePanel accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} onUpdated={refresh} />
    </div>
  )
}
