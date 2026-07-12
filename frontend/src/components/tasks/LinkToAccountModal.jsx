import { useState } from 'react'
import { useAccounts } from '../../hooks/useAccounts.js'
import SearchableSelect from '../ui/SearchableSelect.jsx'

export default function LinkToAccountModal({ task, onClose, onLink }) {
  const { accounts } = useAccounts()
  const [accountId, setAccountId] = useState('')
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name, archived: Boolean(a.deleted_at) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!accountId) {
      setSubmitAttempted(true)
      return
    }
    setLinking(true)
    setError(null)
    try {
      await onLink(accountId)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-5 shadow-xl"
      >
        <h2 className="mb-1 text-[15px] font-medium text-text-primary">Link to account</h2>
        <p className="mb-4 text-[12px] text-text-secondary">
          &ldquo;{task.task_name}&rdquo; is a partner-only task. Pick the account it belongs to.
        </p>

        <div className="mb-4">
          <SearchableSelect
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            placeholder="Select account…"
          />
          {submitAttempted && !accountId && (
            <span className="mt-1 block text-[11px] text-urgent">An account is required.</span>
          )}
        </div>

        {error && <p className="mb-3 text-[12px] text-urgent">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-raised"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={linking}
            className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {linking ? 'Linking…' : 'Link'}
          </button>
        </div>
      </form>
    </div>
  )
}
