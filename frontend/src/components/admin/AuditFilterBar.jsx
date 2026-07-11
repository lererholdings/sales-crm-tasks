import { useUsers } from '../../hooks/useUsers.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../lib/constants.js'
import FilterChip from '../ui/FilterChip.jsx'

export default function AuditFilterBar({ filters, onFilterChange }) {
  const { users } = useUsers()
  const userOptions = users.map((u) => ({ value: u.id, label: u.display_name }))
  const entityTypeOptions = AUDIT_ENTITY_TYPES.map((value) => ({ value, label: value }))
  const actionOptions = AUDIT_ACTIONS.map((value) => ({ value, label: value }))

  const setFilter = (key) => (value) => onFilterChange({ ...filters, [key]: value ?? undefined, offset: 0 })

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-surface p-3">
      <FilterChip icon="ti-user" label="User" options={userOptions} value={filters.user_id} onChange={setFilter('user_id')} />
      <FilterChip icon="ti-category" label="Entity type" options={entityTypeOptions} value={filters.entity_type} onChange={setFilter('entity_type')} />
      <FilterChip icon="ti-bolt" label="Action" options={actionOptions} value={filters.action} onChange={setFilter('action')} />
      <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
        From
        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => setFilter('from')(e.target.value)}
          className="rounded-lg border border-border bg-bg-input px-2 py-1 text-[12px] text-text-primary"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
        To
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => setFilter('to')(e.target.value)}
          className="rounded-lg border border-border bg-bg-input px-2 py-1 text-[12px] text-text-primary"
        />
      </label>
    </div>
  )
}
