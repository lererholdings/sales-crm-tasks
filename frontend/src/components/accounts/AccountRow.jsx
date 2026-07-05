export default function AccountRow({ account, onClick }) {
  const archived = Boolean(account.deleted_at)

  return (
    <tr
      className={`cursor-pointer border-b border-border bg-bg-surface hover:bg-bg-raised ${archived ? 'opacity-60' : ''}`}
      onClick={() => onClick(account)}
    >
      <td className="px-3 py-2 text-[13px] font-medium text-accent">
        {account.name}
        {archived && <span className="ml-1.5 text-[11px] font-normal text-text-muted">(archived)</span>}
      </td>
      <td className="px-3 py-2 text-[13px] text-text-secondary">{account.country}</td>
      <td className="px-3 py-2 text-[13px]">
        {account.sfdc_account_url ? (
          <a
            href={account.sfdc_account_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-accent hover:underline"
          >
            <i className="ti ti-external-link" />
          </a>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-[12px] text-text-secondary">
        {account.last_updated_by ? `${account.last_updated_by.display_name} · ` : ''}
        {new Date(account.updated_at).toLocaleDateString()}
      </td>
    </tr>
  )
}
