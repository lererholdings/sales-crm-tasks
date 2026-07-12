import { query } from './db.js'

export const VALID_STATUSES = ['backlog', 'in_progress', 'waiting', 'done']
export const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low']

export const TASK_AUDIT_FIELDS = [
  'task_name',
  'account_id',
  'partner_name',
  'distributor_name',
  'task_type_id',
  'status',
  'priority',
  'eta',
  'next_action',
  'assignee_id',
  'sfdc_task_url',
]

export const TASK_TEXT_FIELD_RULES = {
  task_name: { maxLength: 300 },
  partner_name: { maxLength: 300 },
  distributor_name: { maxLength: 300 },
  next_action: { maxLength: 500 },
  sfdc_task_url: { url: true },
}

export const TASK_BASE_SELECT = `
  SELECT t.id, t.task_name, t.partner_name, t.distributor_name, t.status, t.priority,
         t.eta, t.next_action, t.sfdc_task_url, t.updated_at, t.deleted_at,
         a.id AS account_id, a.name AS account_name, a.country AS account_country,
         a.acv AS account_acv, a.sfdc_account_url AS account_sfdc_url,
         tt.id AS task_type_id, tt.category AS task_type_category, tt.name AS task_type_name,
         assignee.id AS assignee_id, assignee.display_name AS assignee_name,
         updater.id AS updated_by_id, updater.display_name AS updated_by_name
  FROM tasks t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN task_types tt ON tt.id = t.task_type_id
  LEFT JOIN users assignee ON assignee.id = t.assignee_id
  LEFT JOIN users updater ON updater.id = t.last_updated_by
`

export function toTask(row) {
  return {
    id: row.id,
    task_name: row.task_name,
    account: row.account_id
      ? {
          id: row.account_id,
          name: row.account_name,
          country: row.account_country,
          acv: row.account_acv === null ? null : Number(row.account_acv),
          sfdc_account_url: row.account_sfdc_url,
        }
      : null,
    partner_name: row.partner_name,
    distributor_name: row.distributor_name,
    task_type: row.task_type_id
      ? { id: row.task_type_id, category: row.task_type_category, name: row.task_type_name }
      : null,
    status: row.status,
    priority: row.priority,
    eta: row.eta,
    next_action: row.next_action,
    assignee: row.assignee_id ? { id: row.assignee_id, display_name: row.assignee_name } : null,
    sfdc_task_url: row.sfdc_task_url,
    last_updated_by: row.updated_by_id ? { id: row.updated_by_id, display_name: row.updated_by_name } : null,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

// Attaches the latest `notesLimit` notes (oldest-first within that window)
// plus a notes_total count, in one query via window functions rather than
// N+1 queries per task.
export async function attachNotes(tasks, notesLimit) {
  if (tasks.length === 0) return tasks
  const taskIds = tasks.map((t) => t.id)
  const { rows: noteRows } = await query(
    `SELECT * FROM (
       SELECT n.task_id, n.id, n.content, n.created_at, n.edited_at,
              u.id AS user_id, u.display_name AS user_display_name,
              ROW_NUMBER() OVER (PARTITION BY n.task_id ORDER BY n.created_at DESC) AS rn,
              COUNT(*) OVER (PARTITION BY n.task_id) AS total_count
       FROM task_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.task_id = ANY($1) AND n.deleted_at IS NULL
     ) ranked
     WHERE rn <= $2
     ORDER BY task_id, created_at DESC`,
    [taskIds, notesLimit],
  )

  const notesByTask = new Map()
  const totalsByTask = new Map()
  for (const row of noteRows) {
    if (!notesByTask.has(row.task_id)) notesByTask.set(row.task_id, [])
    notesByTask.get(row.task_id).push({
      id: row.id,
      content: row.content,
      user: row.user_id ? { id: row.user_id, display_name: row.user_display_name } : null,
      created_at: row.created_at,
      edited_at: row.edited_at,
    })
    totalsByTask.set(row.task_id, Number(row.total_count))
  }

  return tasks.map((t) => ({
    ...t,
    notes: notesByTask.get(t.id) ?? [],
    notes_total: totalsByTask.get(t.id) ?? 0,
  }))
}
