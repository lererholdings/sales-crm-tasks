import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import AdminNav from '../components/admin/AdminNav.jsx'
import AuditLogPanel from '../components/admin/AuditLogPanel.jsx'
import TaskTypesPanel from '../components/admin/TaskTypesPanel.jsx'
import UsersPanel from '../components/admin/UsersPanel.jsx'

export default function AdminPage() {
  const { user: currentUser, loading } = useCurrentUser()
  const [activeTab, setActiveTab] = useState('task-types')

  // Backend already 403s non-admin calls on every admin endpoint — this is
  // the UI-level mirror of that, not the actual enforcement. Waits for the
  // real role to load before redirecting, so a member is never bounced on
  // an unresolved/default value.
  if (loading) return null
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
