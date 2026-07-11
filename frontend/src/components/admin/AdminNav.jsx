const TABS = [
  { key: 'task-types', label: 'Task Types' },
  { key: 'users', label: 'Users' },
  { key: 'audit-log', label: 'Audit Log' },
]

export default function AdminNav({ activeTab, onSelectTab }) {
  return (
    <div className="flex gap-1 border-b border-border bg-bg-surface px-3 pt-2">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelectTab(tab.key)}
          className={`rounded-t-lg px-3 py-2 text-[13px] font-medium ${
            activeTab === tab.key
              ? 'border-b-2 border-accent-strong text-accent-strong'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
