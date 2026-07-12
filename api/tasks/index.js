import { withAuth } from '../../lib/auth.js'
import { withAudit } from '../../lib/audit.js'
import { query } from '../../lib/db.js'
import {
  TASK_AUDIT_FIELDS,
  TASK_BASE_SELECT,
  TASK_TEXT_FIELD_RULES,
  VALID_PRIORITIES,
  VALID_STATUSES,
  attachNotes,
  toTask,
} from '../../lib/tasks.js'
import { sendError } from '../../lib/errors.js'
import { validateTextFields } from '../../lib/validation.js'

// Allowlisted so sort_by (a raw query param) can never be interpolated
// directly into SQL — anything not in this map falls back to the default.
const SORTABLE_COLUMNS = {
  task_name: 't.task_name',
  status: 't.status',
  priority: 't.priority',
  eta: 't.eta',
  updated_at: 't.updated_at',
  created_at: 't.created_at',
  account_name: 'a.name',
  assignee_name: 'assignee.display_name',
}

async function handleGet(req, res, user) {
  const q = req.query
  const includeDeleted = q.include_deleted === 'true'
  if (includeDeleted && user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden')
  }

  const conditions = []
  const params = []

  if (!includeDeleted) conditions.push('t.deleted_at IS NULL')

  if (q.account_id) {
    params.push(q.account_id)
    conditions.push(`t.account_id = $${params.length}`)
  }
  if (q.assignee_id) {
    params.push(q.assignee_id)
    conditions.push(`t.assignee_id = $${params.length}`)
  }
  if (q.status) {
    const statuses = q.status.split(',').filter(Boolean)
    if (statuses.length === 0 || statuses.some((s) => !VALID_STATUSES.includes(s))) {
      return sendError(res, 400, 'Invalid status')
    }
    const placeholders = statuses.map((s) => {
      params.push(s)
      return `$${params.length}`
    })
    conditions.push(`t.status IN (${placeholders.join(', ')})`)
  }
  if (q.priority) {
    const priorities = q.priority.split(',').filter(Boolean)
    if (priorities.length === 0 || priorities.some((p) => !VALID_PRIORITIES.includes(p))) {
      return sendError(res, 400, 'Invalid priority')
    }
    const placeholders = priorities.map((p) => {
      params.push(p)
      return `$${params.length}`
    })
    conditions.push(`t.priority IN (${placeholders.join(', ')})`)
  }
  if (q.task_type_id) {
    params.push(q.task_type_id)
    conditions.push(`t.task_type_id = $${params.length}`)
  }
  if (q.partner_name) {
    params.push(`%${q.partner_name}%`)
    conditions.push(`t.partner_name ILIKE $${params.length}`)
  }
  if (q.search) {
    params.push(`%${q.search}%`)
    const idx = params.length
    conditions.push(
      `(t.task_name ILIKE $${idx} OR EXISTS (
         SELECT 1 FROM task_notes n WHERE n.task_id = t.id AND n.deleted_at IS NULL AND n.content ILIKE $${idx}
       ))`,
    )
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sortColumn = SORTABLE_COLUMNS[q.sort_by] ?? 't.updated_at'
  const sortDir = q.sort_dir === 'desc' ? 'DESC' : 'ASC'
  const notesLimit = Number.parseInt(q.notes_limit, 10) || 2

  const { rows } = await query(`${TASK_BASE_SELECT} ${whereClause} ORDER BY ${sortColumn} ${sortDir}`, params)
  const tasks = await attachNotes(rows.map(toTask), notesLimit)
  res.status(200).json(tasks)
}

async function handleCreate(req, res, user) {
  const body = req.body ?? {}
  const { task_name: taskName, assignee_id: assigneeId, task_type_id: taskTypeId } = body

  const textFieldError = validateTextFields(body, TASK_TEXT_FIELD_RULES)
  if (textFieldError) return sendError(res, 400, textFieldError)
  if (!taskName || typeof taskName !== 'string' || !taskName.trim() || !assigneeId || !taskTypeId) {
    return sendError(res, 400, 'task_name, assignee_id, and task_type_id are required')
  }

  const { rows: assigneeRows } = await query('SELECT id FROM users WHERE id = $1', [assigneeId])
  if (assigneeRows.length === 0) return sendError(res, 400, 'assignee_id does not exist')

  const { rows: taskTypeRows } = await query('SELECT id FROM task_types WHERE id = $1 AND active = true', [
    taskTypeId,
  ])
  if (taskTypeRows.length === 0) return sendError(res, 400, 'task_type_id does not exist or is inactive')

  const { rows } = await query(
    `INSERT INTO tasks (
       task_name, account_id, partner_name, distributor_name, task_type_id,
       status, priority, eta, next_action, assignee_id, sfdc_task_url, last_updated_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      taskName,
      body.account_id ?? null,
      body.partner_name ?? null,
      body.distributor_name ?? null,
      taskTypeId,
      body.status ?? 'backlog',
      body.priority ?? 'medium',
      body.eta ?? null,
      body.next_action ?? null,
      assigneeId,
      body.sfdc_task_url ?? null,
      user.id,
    ],
  )

  const { rows: fullRows } = await query(`${TASK_BASE_SELECT} WHERE t.id = $1`, [rows[0].id])
  const [task] = await attachNotes([toTask(fullRows[0])], 2)
  res.status(201).json(task)
}

// Only POST goes through withAudit — GET is read-only, nothing to log.
const auditedCreate = withAudit({ table: 'tasks', entityType: 'task', fields: TASK_AUDIT_FIELDS }, handleCreate)

export default withAuth(async (req, res, user) => {
  if (req.method === 'GET') return handleGet(req, res, user)
  if (req.method === 'POST') return auditedCreate(req, res, user)
  return sendError(res, 405, 'Method not allowed')
})
