import AuditRow from './AuditRow.jsx'

export default function AuditTable({ entries }) {
  if (entries.length === 0) {
    return <p className="p-4 text-sm text-text-secondary">No audit events match these filters.</p>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <th className="px-3 py-2">Timestamp</th>
          <th className="px-3 py-2">User</th>
          <th className="px-3 py-2">Entity</th>
          <th className="px-3 py-2">Action</th>
          <th className="px-3 py-2">Changed fields</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </tbody>
    </table>
  )
}
