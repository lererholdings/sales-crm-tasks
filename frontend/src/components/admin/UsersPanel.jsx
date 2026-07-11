import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useUsers } from '../../hooks/useUsers.js'
import { useApiClient } from '../../lib/apiClient.js'
import UserList from './UserList.jsx'

export default function UsersPanel() {
  const { users, loading, error, refresh } = useUsers()
  const { user: currentUser } = useCurrentUser()
  const apiClient = useApiClient()

  const handleChangeRole = async (id, role) => {
    await apiClient.patch(`/users/${id}`, { role })
    await refresh()
  }

  return (
    <div>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-urgent">Failed to load users.</p>}
      {!loading && !error && (
        <UserList users={users} currentUserId={currentUser?.id} onChangeRole={handleChangeRole} />
      )}
    </div>
  )
}
