import AccountRow from './AccountRow.jsx'

export default function AccountTable({ accounts, onSelectAccount }) {
  if (accounts.length === 0) {
    return <p className="p-6 text-sm text-text-secondary">No accounts yet.</p>
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[12px] font-medium text-text-secondary">
          <th className="px-3 py-2">Name</th>
          <th className="px-3 py-2">Country</th>
          <th className="px-3 py-2">SFDC</th>
          <th className="px-3 py-2">Last updated</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <AccountRow key={account.id} account={account} onClick={onSelectAccount} />
        ))}
      </tbody>
    </table>
  )
}
