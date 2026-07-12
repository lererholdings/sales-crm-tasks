import { isSafeUrl } from '../../lib/safeUrl.js'

const SECONDARY_TEXT = 'text-[13px] text-text-secondary'
const SECONDARY_TEXT_COLUMNS = new Set(['country', 'last_updated'])

function renderCell(columnKey, account) {
  switch (columnKey) {
    case 'country':
      return account.country
    case 'acv':
      return account.acv == null ? '—' : account.acv.toLocaleString()
    case 'sfdc':
      return isSafeUrl(account.sfdc_account_url) ? (
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
      )
    case 'last_updated':
      return (
        <>
          {account.last_updated_by ? `${account.last_updated_by.display_name} · ` : ''}
          {new Date(account.updated_at).toLocaleDateString()}
        </>
      )
    default:
      return null
  }
}

// columns: ordered array of visible column configs from lib/accountColumns.js
// (name isn't included here — it's always the first, pinned cell).
export default function AccountRow({ account, columns, onClick }) {
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
      {columns.map((col) => (
        <td key={col.key} className={`px-3 py-2 ${SECONDARY_TEXT_COLUMNS.has(col.key) ? SECONDARY_TEXT : 'text-[13px]'}`}>
          {renderCell(col.key, account)}
        </td>
      ))}
    </tr>
  )
}
