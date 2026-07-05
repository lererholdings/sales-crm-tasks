function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Avatars are green/blue only per design.md's UI theme decision — hashing the
// user id keeps each person's colour consistent across renders and sessions
// without needing to store a colour choice anywhere.
function avatarColorClass(id) {
  if (!id) return 'bg-avatar-green'
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 2
  return hash === 0 ? 'bg-avatar-green' : 'bg-avatar-blue'
}

export default function AssigneeChip({ user, size = 'sm' }) {
  if (!user) return <span className="text-[12px] text-text-muted">—</span>

  const sizeClass = size === 'lg' ? 'h-6 w-6 text-[10px]' : 'h-[22px] w-[22px] text-[9px]'

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
      <span
        className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-medium text-white ${sizeClass} ${avatarColorClass(user.id)}`}
      >
        {initials(user.display_name)}
      </span>
      {user.display_name}
    </span>
  )
}
