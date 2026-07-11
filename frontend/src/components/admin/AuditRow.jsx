import { Link } from 'react-router-dom'
import { AUDIT_ACTION_TEXT_CLASS, formatAuditValue } from '../../lib/auditFormat.js'

// user/task_type don't have a per-item page, so they link to the relevant
// admin tab rather than a specific row — see api/audit-log/index.js's
// deriveEntityDisplay for where entity_link is computed.
function entityHref(link) {
  if (!link) return null
  switch (link.type) {
    case 'task':
      return `/tasks?taskId=${link.id}`
    case 'account':
      return `/accounts?accountId=${link.id}`
    case 'user':
      return '/admin?tab=users'
    case 'task_type':
      return '/admin?tab=task-types'
    default:
      return null
  }
}

export default function AuditRow({ entry }) {
  const href = entityHref(entry.entity_link)

  return (
    <tr className="border-b border-border align-top">
      <td className="whitespace-nowrap px-3 py-2 text-[12px] text-text-secondary">
        {new Date(entry.timestamp).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">{entry.user?.display_name ?? '—'}</td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        <span className="text-text-muted">{entry.entity_type}</span>{' '}
        {href ? (
          <Link to={href} className="text-accent hover:underline">
            {entry.entity_label}
          </Link>
        ) : (
          entry.entity_label
        )}
      </td>
      <td
        className={`px-3 py-2 text-[12px] font-medium ${AUDIT_ACTION_TEXT_CLASS[entry.action] ?? 'text-text-secondary'}`}
      >
        {entry.action}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 ? (
          <ul>
            {Object.entries(entry.changed_fields).map(([field, change]) => (
              <li key={field}>
                <span className="font-medium text-text-primary">{field}</span>: {formatAuditValue(change.from)} →{' '}
                {formatAuditValue(change.to)}
              </li>
            ))}
          </ul>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}
