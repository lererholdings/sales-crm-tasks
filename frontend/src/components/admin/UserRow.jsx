import AssigneeChip from '../ui/AssigneeChip.jsx'

export default function UserRow({ user, isSelf, onChangeRole }) {
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2">
        <AssigneeChip user={user} />
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">{user.email}</td>
      <td className="px-3 py-2">
        <select
          value={user.role}
          onChange={(e) => onChangeRole(user.id, e.target.value)}
          disabled={isSelf}
          title={isSelf ? "You can't change your own role" : undefined}
          className="rounded-lg border border-border bg-bg-input px-2.5 py-1 text-[13px] text-text-primary disabled:opacity-50"
        >
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>
      </td>
    </tr>
  )
}
