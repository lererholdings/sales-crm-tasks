import UserRow from './UserRow.jsx'

export default function UserList({ users, currentUserId, onChangeRole }) {
  if (users.length === 0) {
    return <p className="p-4 text-sm text-text-secondary">No users yet.</p>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Email</th>
          <th className="px-3 py-2">Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} onChangeRole={onChangeRole} />
        ))}
      </tbody>
    </table>
  )
}
