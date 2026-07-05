import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants.js'

export default function PriorityBadge({ priority }) {
  const colors = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  )
}
