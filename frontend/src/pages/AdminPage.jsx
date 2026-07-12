import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import AdminNav from '../components/admin/AdminNav.jsx'
import AuditLogPanel from '../components/admin/AuditLogPanel.jsx'
import TaskTypesPanel from '../components/admin/TaskTypesPanel.jsx'
import UsersPanel from '../components/admin/UsersPanel.jsx'

const VALID_TABS = ['task-types', 'users', 'audit-log']

export default function AdminPage() {
  const { user: currentUser, loading, error } = useCurrentUser()
  // Deep-link entry point (e.g. from an audit log entry's "user"/"task_type"
  // link). Unlike TasksPage's ?taskId= (which always lands via a route
  // change from elsewhere, so a mount-time read is enough), a "user"/
  // "task_type" audit link can point from the Audit Log tab back to another
  // tab on this *same* route — a query-string-only navigation that doesn't
  // remount AdminPage. So this does need to react to searchParams changing,
  // not just read it once.
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab')
    return VALID_TABS.includes(tab) ? tab : 'task-types'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (VALID_TABS.includes(tab)) setActiveTab(tab)
  }, [searchParams])

  // Backend already 403s non-admin calls on every admin endpoint — this is
  // the UI-level mirror of that, not the actual enforcement. Waits for the
  // real role to load before redirecting, so a member is never bounced on
  // an unresolved/default value.
  if (loading) return <p className="p-6 text-sm text-text-secondary">Loading…</p>
  // Surfaced distinctly from the "not an admin" redirect below — otherwise a
  // failed /users?me=true call looks identical to a member being bounced.
  if (error) return <p className="p-6 text-sm text-urgent">Failed to load your account. Please refresh.</p>
  if (currentUser?.role !== 'admin') return <Navigate to="/tasks" replace />

  return (
    <div className="flex h-full flex-col">
      <AdminNav activeTab={activeTab} onSelectTab={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {activeTab === 'task-types' && <TaskTypesPanel />}
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'audit-log' && <AuditLogPanel />}
      </div>
    </div>
  )
}
