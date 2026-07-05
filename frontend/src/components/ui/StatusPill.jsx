import { STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from '../../lib/constants.js'

export default function StatusPill({ status }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.backlog

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${colors.bg} ${colors.text}`}
    >
      <i className={`ti ${STATUS_ICONS[status] ?? 'ti-circle'} text-[11px]`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
