-- Lets the audit log trace a change back to the task (and account) it
-- happened on, not just the raw entity_type/entity_id of the row that
-- changed — a task_note audit entry on its own only identifies the note,
-- with no way to tell which task it belongs to. Nullable: task_type/user
-- entries aren't task/account-scoped and stay null.
ALTER TABLE audit_log
  ADD COLUMN task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- New hot path: a task's own "view history" pulls every audit_log row for
-- that task_id, not just entity_type='task' rows for its own entity_id.
CREATE INDEX idx_audit_log_task_id ON audit_log(task_id);

-- Backfill existing rows so a task's history is complete immediately,
-- not just for changes made after this migration.
UPDATE audit_log
SET task_id = entity_id
WHERE entity_type = 'task';

UPDATE audit_log a
SET account_id = t.account_id
FROM tasks t
WHERE a.entity_type = 'task' AND a.entity_id = t.id AND t.account_id IS NOT NULL;

UPDATE audit_log
SET account_id = entity_id
WHERE entity_type = 'account';

UPDATE audit_log a
SET task_id = n.task_id
FROM task_notes n
WHERE a.entity_type = 'task_note' AND a.entity_id = n.id;
