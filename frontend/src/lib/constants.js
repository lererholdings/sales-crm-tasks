// Mirrors lib/tasks.js's VALID_STATUSES / VALID_PRIORITIES on the backend.
export const TASK_STATUSES = ['backlog', 'in_progress', 'waiting', 'done']
export const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low']

export const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
}

export const STATUS_ICONS = {
  backlog: 'ti-circle',
  in_progress: 'ti-circle-dot',
  waiting: 'ti-clock',
  done: 'ti-circle-check',
}

export const STATUS_COLORS = {
  backlog: { bg: 'bg-bg-raised', text: 'text-text-secondary' },
  in_progress: { bg: 'bg-status-ip-bg', text: 'text-status-ip-text' },
  waiting: { bg: 'bg-status-wait-bg', text: 'text-status-wait-text' },
  done: { bg: 'bg-status-done-bg', text: 'text-status-done-text' },
}

export const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_COLORS = {
  critical: { bg: 'bg-badge-crit-bg', text: 'text-badge-crit-text' },
  high: { bg: 'bg-badge-high-bg', text: 'text-badge-high-text' },
  medium: { bg: 'bg-badge-med-bg', text: 'text-badge-med-text' },
  low: { bg: 'bg-bg-raised', text: 'text-text-secondary' },
}
