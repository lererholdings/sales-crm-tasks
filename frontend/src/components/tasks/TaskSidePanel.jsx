import { useEffect, useState } from 'react'
import { useAccounts } from '../../hooks/useAccounts.js'
import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useTask } from '../../hooks/useTask.js'
import { useTaskHistory } from '../../hooks/useTaskHistory.js'
import { useTaskTypes } from '../../hooks/useTaskTypes.js'
import { useUsers } from '../../hooks/useUsers.js'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants.js'
import PriorityBadge from '../ui/PriorityBadge.jsx'
import SearchableSelect from '../ui/SearchableSelect.jsx'
import SidePanel from '../ui/SidePanel.jsx'
import StatusPill from '../ui/StatusPill.jsx'
import NotesTimeline from './NotesTimeline.jsx'
import TaskHistoryTimeline from './TaskHistoryTimeline.jsx'

const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
const PRIORITY_OPTIONS = TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))

export default function TaskSidePanel({ taskId, notesPreviewCount = 2, onClose, onUpdated, onNotesChanged }) {
  const { task, notes, notesTotal, loading, updateTask, loadMoreNotes, addNote, editNote } = useTask(taskId)
  const { entries: historyEntries, total: historyTotal, loading: historyLoading, loadMore: loadMoreHistory } =
    useTaskHistory(taskId)
  const { accounts } = useAccounts()
  const { taskTypes } = useTaskTypes()
  const { users } = useUsers()
  const { user: currentUser } = useCurrentUser()

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!task) return
    setForm({
      account_id: task.account?.id ?? '',
      partner_name: task.partner_name ?? '',
      distributor_name: task.distributor_name ?? '',
      task_type_id: task.task_type?.id ?? '',
      eta: task.eta ?? '',
      assignee_id: task.assignee?.id ?? '',
      next_action: task.next_action ?? '',
      status: task.status,
      priority: task.priority,
    })
  }, [task])

  if (!taskId) return null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateTask({
        account_id: form.account_id || null,
        partner_name: form.partner_name || null,
        distributor_name: form.distributor_name || null,
        task_type_id: form.task_type_id,
        eta: form.eta || null,
        assignee_id: form.assignee_id,
        next_action: form.next_action || null,
        status: form.status,
        priority: form.priority,
      })
      onUpdated?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Notes changes don't refetch the task list — they patch just this row's
  // preview slice in place (see hooks/useTasks.js's updateTaskInPlace), so
  // TaskRow's React.memo can skip re-rendering every other row.
  const handleAddNote = async (content) => {
    const note = await addNote(content)
    onNotesChanged?.(taskId, [note, ...notes].slice(0, notesPreviewCount))
    return note
  }

  const handleEditNote = async (noteId, content) => {
    const updated = await editNote(noteId, content)
    onNotesChanged?.(
      taskId,
      notes.map((n) => (n.id === noteId ? updated : n)).slice(0, notesPreviewCount),
    )
    return updated
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name, archived: Boolean(a.deleted_at) }))
  // Deactivated subtypes are excluded from selection, except the task's own
  // current type (if it was deactivated after being assigned) — otherwise
  // an existing task's type would silently disappear from its own dropdown.
  const taskTypeOptions = taskTypes
    .filter((t) => t.active || t.id === form?.task_type_id)
    .map((t) => ({ value: t.id, label: `${t.category} · ${t.name}` }))
  const userOptions = users.map((u) => ({ value: u.id, label: u.display_name }))

  return (
    <SidePanel open={Boolean(taskId)} onClose={onClose}>
      <div className="border-b border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-text-primary">{task?.task_name ?? 'Task'}</h2>
          <button type="button" onClick={onClose} aria-label="Close task panel" className="text-text-secondary hover:text-text-primary">
            <i className="ti ti-x" />
          </button>
        </div>
        {task && (
          <div className="flex gap-1.5">
            <StatusPill status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
        )}
      </div>

      {loading && !task && <p className="p-4 text-sm text-text-secondary">Loading…</p>}

      {task && form && (
        <>
          <div className="border-b border-border p-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">Account</p>
            <div className="mb-2">
              <SearchableSelect
                options={accountOptions}
                value={form.account_id}
                onChange={(v) => setForm({ ...form, account_id: v })}
                placeholder="No account (partner only)"
              />
            </div>
            <label className="mb-2 block text-[12px] text-text-secondary">
              Partner
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
                value={form.partner_name}
                onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
              />
            </label>
            <label className="mb-2 block text-[12px] text-text-secondary">
              Distributor
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
                value={form.distributor_name}
                onChange={(e) => setForm({ ...form, distributor_name: e.target.value })}
              />
            </label>
            {task.account && (
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="text-text-secondary">Country</span>
                <span className="font-medium text-text-primary">{task.account.country}</span>
              </div>
            )}
            {task.account?.acv != null && (
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="text-text-secondary">ACV</span>
                <span className="font-medium text-accent">${task.account.acv.toLocaleString()}</span>
              </div>
            )}
            <div className="flex gap-3">
              {task.account?.sfdc_account_url && (
                <a
                  href={task.account.sfdc_account_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                >
                  <i className="ti ti-external-link" /> SFDC account
                </a>
              )}
              {task.sfdc_task_url && (
                <a
                  href={task.sfdc_task_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
                >
                  <i className="ti ti-external-link" /> SFDC task
                </a>
              )}
            </div>
          </div>

          <div className="border-b border-border p-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">Task detail</p>
            <div className="mb-2 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[12px] text-text-secondary">Status</p>
                <SearchableSelect
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(v) => setForm({ ...form, status: v })}
                />
              </div>
              <div>
                <p className="mb-1 text-[12px] text-text-secondary">Priority</p>
                <SearchableSelect
                  options={PRIORITY_OPTIONS}
                  value={form.priority}
                  onChange={(v) => setForm({ ...form, priority: v })}
                />
              </div>
            </div>
            <div className="mb-2">
              <SearchableSelect
                options={taskTypeOptions}
                value={form.task_type_id}
                onChange={(v) => setForm({ ...form, task_type_id: v })}
                placeholder="Select type…"
              />
            </div>
            <label className="mb-2 block text-[12px] text-text-secondary">
              ETA
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
                value={form.eta}
                onChange={(e) => setForm({ ...form, eta: e.target.value })}
              />
            </label>
            <div className="mb-2">
              <p className="mb-1 text-[12px] text-text-secondary">Assignee</p>
              <SearchableSelect
                options={userOptions}
                value={form.assignee_id}
                onChange={(v) => setForm({ ...form, assignee_id: v })}
                placeholder="Select assignee…"
              />
            </div>
            <label className="mb-2 block text-[12px] text-text-secondary">
              Next action
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
                value={form.next_action}
                onChange={(e) => setForm({ ...form, next_action: e.target.value })}
              />
            </label>

            {error && <p className="mb-2 text-[12px] text-urgent">{error}</p>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {task.last_updated_by && (
              <p className="mt-2 text-[11px] text-text-muted">
                Updated by {task.last_updated_by.display_name} on {new Date(task.updated_at).toLocaleString()}
              </p>
            )}
          </div>

          <NotesTimeline
            notes={notes}
            notesTotal={notesTotal}
            currentUserId={currentUser?.id}
            onLoadMore={loadMoreNotes}
            onAddNote={handleAddNote}
            onEditNote={handleEditNote}
          />

          <TaskHistoryTimeline
            entries={historyEntries}
            total={historyTotal}
            loading={historyLoading}
            onLoadMore={loadMoreHistory}
          />
        </>
      )}
    </SidePanel>
  )
}
