import { useEffect, useState } from 'react'
import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useApiClient } from '../../lib/apiClient.js'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import SidePanel from '../ui/SidePanel.jsx'

export default function AccountSidePanel({ accountId, onClose, onUpdated }) {
  const apiClient = useApiClient()
  const { user: currentUser } = useCurrentUser()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState(null)

  useEffect(() => {
    if (!accountId) return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    apiClient
      .get(`/accounts/${accountId}`)
      .then((data) => {
        if (cancelled) return
        setAccount(data)
        setForm({
          name: data.name,
          country: data.country,
          acv: data.acv ?? '',
          sfdc_account_url: data.sfdc_account_url ?? '',
        })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, apiClient])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await apiClient.patch(`/accounts/${accountId}`, {
        name: form.name,
        country: form.country,
        acv: form.acv === '' ? null : Number(form.acv),
        sfdc_account_url: form.sfdc_account_url || null,
      })
      setAccount(updated)
      onUpdated?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true)
    setArchiveError(null)
    try {
      const updated = await apiClient.delete(`/accounts/${accountId}`)
      setAccount(updated)
      onUpdated?.(updated)
      setShowArchiveConfirm(false)
    } catch (err) {
      setArchiveError(err.message)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <SidePanel open={Boolean(accountId)} onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-[15px] font-medium text-text-primary">
          {account?.name ?? 'Account'}
          {account?.deleted_at && <span className="ml-1.5 text-[12px] font-normal text-text-muted">(archived)</span>}
        </h2>
        <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <i className="ti ti-x" />
        </button>
      </div>

      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}

      {!loading && form && (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <label className="text-[12px] text-text-secondary">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            Country
            <input
              className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            ACV
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
              value={form.acv}
              onChange={(e) => setForm({ ...form, acv: e.target.value })}
            />
          </label>
          <label className="text-[12px] text-text-secondary">
            SFDC account URL
            <input
              className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
              value={form.sfdc_account_url}
              onChange={(e) => setForm({ ...form, sfdc_account_url: e.target.value })}
            />
          </label>

          {account?.sfdc_account_url && (
            <a
              href={account.sfdc_account_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              <i className="ti ti-external-link" /> SFDC account
            </a>
          )}

          {error && <p className="text-[12px] text-urgent">{error}</p>}

          {archiveError && <p className="text-[12px] text-urgent">{archiveError}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            {currentUser?.role === 'admin' && !account?.deleted_at ? (
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(true)}
                className="rounded-lg px-3 py-1.5 text-[13px] text-urgent hover:bg-bg-raised"
              >
                Archive
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {account?.last_updated_by && (
            <p className="text-[11px] text-text-muted">
              Last updated by {account.last_updated_by.display_name} on{' '}
              {new Date(account.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive this account?"
        message="It will stay visible everywhere (greyed out), but can no longer be used for new work unless restored. Only possible when it has no active tasks."
        confirmLabel={archiving ? 'Archiving…' : 'Archive'}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </SidePanel>
  )
}
