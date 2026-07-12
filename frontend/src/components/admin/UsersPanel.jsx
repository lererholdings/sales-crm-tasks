import { useState } from 'react'
import { useCurrentUser } from '../../hooks/useCurrentUser.js'
import { useUsers } from '../../hooks/useUsers.js'
import UserList from './UserList.jsx'

export default function UsersPanel() {
  const { users, loading, error, updateUserRole } = useUsers()
  const { user: currentUser } = useCurrentUser()
  const [mutationError, setMutationError] = useState(null)

  const handleChangeRole = async (id, role) => {
    setMutationError(null)
    try {
      await updateUserRole(id, role)
    } catch (err) {
      setMutationError(err.message)
    }
  }

  return (
    <div>
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-urgent">Failed to load users.</p>}
      {mutationError && <p className="p-4 text-sm text-urgent">{mutationError}</p>}
      {!loading && !error && (
        <UserList users={users} currentUserId={currentUser?.id} onChangeRole={handleChangeRole} />
      )}
    </div>
  )
}
