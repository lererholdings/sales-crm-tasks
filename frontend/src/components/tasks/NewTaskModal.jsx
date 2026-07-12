import { useState } from 'react'
import { useAccounts } from '../../hooks/useAccounts.js'
import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import { useUsers } from '../../hooks/useUsers.js'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants.js'
import SearchableSelect from '../ui/SearchableSelect.jsx'

const EMPTY_FORM = {
  task_name: '',
  account_id: '',
  partner_name: '',
  distributor_name: '',
  task_type_id: '',
  assignee_id: '',
  next_action: '',
  eta: '',
  priority: 'medium',
  status: 'backlog',
}

// Selecting an account prefills partner/distributor from that account's
// most-recently-updated task, if one exists — still just plain text, and
// still editable. (See design.md section 12, "Open questions" — a fuller
// partner/distributor-as-entity redesign was deliberately deferred; this is
// the lightweight version that works with today's schema.)
function findMostRecentTaskForAccount(tasks, accountId) {
  const candidates = tasks.filter((t) => t.account?.id === accountId)
  if (candidates.length === 0) return null
  return candidates.reduce((latest, t) => (new Date(t.updated_at) > new Date(latest.updated_at) ? t : latest))
}

export default function NewTaskModal({ tasks, onClose, onCreate }) {
  const { accounts } = useAccounts()
  const { taskTypes } = useTaskTypes()
  const { users } = useUsers()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name, archived: Boolean(a.deleted_at) }))
  // Deactivated subtypes shouldn't be offered for a brand-new task — see
  // TaskSidePanel.jsx for the editing case, where an already-assigned
  // inactive type still needs to stay selectable.
  const taskTypeOptions = taskTypes
    .filter((t) => t.active)
    .map((t) => ({ value: t.id, label: `${t.category} · ${t.name}` }))
  const userOptions = users.map((u) => ({ value: u.id, label: u.display_name }))
  const priorityOptions = TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))
  // "Done" isn't a sensible starting status for a brand-new task — it's
  // only reachable later by editing an existing task in TaskSidePanel.
  const statusOptions = TASK_STATUSES.filter((s) => s !== 'done').map((s) => ({ value: s, label: STATUS_LABELS[s] }))

  const canSubmit = form.task_name.trim() && form.task_type_id && form.assignee_id

  const handleAccountChange = (accountId) => {
    const lastTask = findMostRecentTaskForAccount(tasks, accountId)
    setForm({
      ...form,
      account_id: accountId,
      partner_name: lastTask?.partner_name ?? '',
      distributor_name: lastTask?.distributor_name ?? '',
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      setSubmitAttempted(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        task_name: form.task_name,
        account_id: form.account_id || undefined,
        partner_name: form.partner_name || undefined,
        distributor_name: form.distributor_name || undefined,
        task_type_id: form.task_type_id,
        assignee_id: form.assignee_id,
        next_action: form.next_action || undefined,
        eta: form.eta || undefined,
        priority: form.priority,
        status: form.status,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-bg-surface p-5 shadow-xl"
      >
        <h2 className="mb-4 text-[15px] font-medium text-text-primary">New task</h2>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Task name
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={form.task_name}
            onChange={(e) => setForm({ ...form, task_name: e.target.value })}
          />
          {submitAttempted && !form.task_name.trim() && (
            <span className="mt-1 block text-[11px] text-urgent">Task name is required.</span>
          )}
        </label>

        <div className="mb-3">
          <p className="mb-1 text-[12px] text-text-secondary">Account (leave blank for a partner-only task)</p>
          <SearchableSelect
            options={accountOptions}
            value={form.account_id}
            onChange={handleAccountChange}
            placeholder="No account"
          />
        </div>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Partner
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={form.partner_name}
            onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
          />
        </label>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Distributor
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={form.distributor_name}
            onChange={(e) => setForm({ ...form, distributor_name: e.target.value })}
          />
        </label>

        <div className="mb-3">
          <p className="mb-1 text-[12px] text-text-secondary">Type</p>
          <SearchableSelect
            options={taskTypeOptions}
            value={form.task_type_id}
            onChange={(v) => setForm({ ...form, task_type_id: v })}
            placeholder="Select type…"
          />
          {submitAttempted && !form.task_type_id && (
            <span className="mt-1 block text-[11px] text-urgent">Type is required.</span>
          )}
        </div>

        <div className="mb-3">
          <p className="mb-1 text-[12px] text-text-secondary">Assignee</p>
          <SearchableSelect
            options={userOptions}
            value={form.assignee_id}
            onChange={(v) => setForm({ ...form, assignee_id: v })}
            placeholder="Select assignee…"
          />
          {submitAttempted && !form.assignee_id && (
            <span className="mt-1 block text-[11px] text-urgent">Assignee is required.</span>
          )}
        </div>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Next action
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={form.next_action}
            onChange={(e) => setForm({ ...form, next_action: e.target.value })}
          />
        </label>

        <label className="mb-3 block text-[12px] text-text-secondary">
          ETA
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={form.eta}
            onChange={(e) => setForm({ ...form, eta: e.target.value })}
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[12px] text-text-secondary">Priority</p>
            <SearchableSelect
              options={priorityOptions}
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
            />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-text-secondary">Status</p>
            <SearchableSelect
              options={statusOptions}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
            />
          </div>
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
            disabled={submitting}
            className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
