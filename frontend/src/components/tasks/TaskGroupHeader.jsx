export default function TaskGroupHeader({ label, isPartnerOnly, count, collapsed, onToggle }) {
  return (
    <tr className="cursor-pointer border-y border-group-border bg-group-bg" onClick={onToggle}>
      <td colSpan={8} className="px-3 py-1.5">
        <div className="flex items-center gap-2 text-[12px] font-medium text-group-text">
          <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`} />
          {label}
          {isPartnerOnly && (
            <span className="rounded-full border border-group-border bg-group-tag-bg px-2 py-0.5 text-[11px] font-normal text-group-tag-text">
              Partner only
            </span>
          )}
          <span className="rounded-full bg-group-count-bg px-2 py-0.5 text-[11px] font-normal text-group-text">
            {count} {count === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      </td>
    </tr>
  )
}
