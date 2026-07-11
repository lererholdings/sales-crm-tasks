import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useUsers } from '../../hooks/useUsers.js'
import UserList from './UserList.jsx'

export default function UsersPanel() {
  const { users, loading, error, updateUserRole } = useUsers()
  const { user: currentUser } = useCurrentUser()

  const handleChangeRole = async (id, role) => {
    await updateUserRole(id, role)
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
