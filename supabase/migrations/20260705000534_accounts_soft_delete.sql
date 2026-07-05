-- Adds soft-delete (archive) support to accounts, mirroring the existing
-- tasks/task_notes pattern (deleted_at + deleted_by, row never removed).
-- See design.md section 12 / issue #5: only admins can archive an account
-- with no active (non-done, non-deleted) tasks against it. Unlike tasks,
-- archived accounts are NOT hidden from lists by default — they still show
-- up (sorted last, grey/labelled "archived" in the UI) rather than being
-- filtered out, so this migration adds the columns without any WHERE
-- deleted_at IS NULL default filtering baked into existing queries.
ALTER TABLE accounts
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
