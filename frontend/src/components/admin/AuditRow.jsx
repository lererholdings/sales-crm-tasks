const ACTION_TEXT_CLASS = {
  created: 'text-accent',
  updated: 'text-status-ip-text',
  deleted: 'text-urgent',
  viewed: 'text-text-muted',
}

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AuditRow({ entry }) {
  return (
    <tr className="border-b border-border align-top">
      <td className="whitespace-nowrap px-3 py-2 text-[12px] text-text-secondary">
        {new Date(entry.timestamp).toLocaleString()}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">{entry.user?.display_name ?? '—'}</td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {entry.entity_type} <span className="text-text-muted">· {entry.entity_id.slice(0, 8)}</span>
      </td>
      <td className={`px-3 py-2 text-[12px] font-medium ${ACTION_TEXT_CLASS[entry.action] ?? 'text-text-secondary'}`}>
        {entry.action}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 ? (
          <ul>
            {Object.entries(entry.changed_fields).map(([field, change]) => (
              <li key={field}>
                <span className="font-medium text-text-primary">{field}</span>: {formatValue(change.from)} →{' '}
                {formatValue(change.to)}
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
