import { CHIP_ACTIVE_CLASSES, CHIP_IDLE_CLASSES } from '../../lib/chipStyles.js'

// Admin-only — GET /api/tasks?include_deleted=true 403s for members, and
// members should never even see the control (see issue #10). Rendering is
// gated by the caller checking currentUser.role, not by this component.
export default function ShowDeletedToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      aria-pressed={active}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12px] ${active ? CHIP_ACTIVE_CLASSES : CHIP_IDLE_CLASSES}`}
    >
      <i className="ti ti-trash text-[13px]" /> Show deleted
    </button>
  )
}
