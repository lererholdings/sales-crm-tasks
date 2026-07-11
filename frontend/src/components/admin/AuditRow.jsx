import { Link } from 'react-router-dom'
import { AUDIT_ACTION_TEXT_CLASS, formatAuditValue } from '../../lib/auditFormat.js'

export default function AuditRow({ entry }) {
  return (
    <tr className="border-b border-border align-top">
      <td className="whitespace-nowrap px-3 py-2 text-[12px] text-text-secondary">
        {new Date(entry.timestamp).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">{entry.user?.display_name ?? '—'}</td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {entry.entity_type} <span className="text-text-muted">· {entry.entity_id.slice(0, 8)}</span>
        {entry.task_id && (
          <Link to={`/tasks?taskId=${entry.task_id}`} className="ml-2 text-accent hover:underline">
            <i className="ti ti-external-link text-[11px]" /> View task
          </Link>
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
