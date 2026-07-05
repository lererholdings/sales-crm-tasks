-- ============================================================
-- Sales CRM — Postgres DDL
-- Target: Supabase (plain Postgres, no proprietary features)
--
-- This is a flattened reference copy for quick reading.
-- The applied source of truth is supabase/migrations/ — run
-- `npx supabase db push` to deploy. New schema changes go in a
-- new migration file, not edited here.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TYPE task_status AS ENUM (
  'backlog',
  'in_progress',
  'waiting',
  'done'
);

CREATE TYPE task_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

CREATE TYPE task_category AS ENUM (
  'pre-sale',
  'post-sale',
  'account'
);

CREATE TYPE audit_action AS ENUM (
  'created',
  'updated',
  'deleted',
  'viewed'
);

CREATE TYPE external_source AS ENUM (
  'manual',
  'outlook',
  'sfdc'
);

CREATE TYPE theme_preference AS ENUM ('light', 'dark');

-- ============================================================
-- USERS
-- Clerk handles auth — we store only the reference ID.
-- ============================================================

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id    TEXT        UNIQUE NOT NULL,
  display_name     TEXT        NOT NULL,
  email            TEXT        UNIQUE NOT NULL,
  role             user_role   NOT NULL DEFAULT 'member',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACCOUNTS
-- A customer or prospect.
-- ACV changes over time (e.g. at renewal); patched in place,
-- history preserved via audit_log.
-- ============================================================

CREATE TABLE accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  country           TEXT        NOT NULL,
  acv               NUMERIC(15,2),                -- Annual Contract Value; patchable
  sfdc_account_url  TEXT,                         -- opens in new tab on the client
  last_updated_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft delete (archive) — issue #5. Unlike tasks, archived accounts are
  -- NOT hidden by default: they stay visible everywhere (sorted last,
  -- greyed out in the UI) rather than filtered out of list queries.
  deleted_at        TIMESTAMPTZ,                   -- null = active
  deleted_by        UUID        REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TASK TYPES
-- Admin-configurable list of subtypes per category.
-- ============================================================

CREATE TABLE task_types (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category    task_category NOT NULL,
  name        TEXT          NOT NULL,
  active      BOOLEAN       NOT NULL DEFAULT true,
  UNIQUE (category, name)
);

-- Seed — safe to re-run (INSERT ... ON CONFLICT DO NOTHING)
INSERT INTO task_types (category, name) VALUES
  ('pre-sale',  'Demo'),
  ('pre-sale',  'POC'),
  ('pre-sale',  'RFI'),
  ('pre-sale',  'RFP'),
  ('pre-sale',  'Follow-up'),
  ('post-sale', 'Support ticket follow-up'),
  ('post-sale', 'Technical session'),
  ('post-sale', 'Best practice advice'),
  ('post-sale', 'Focus demo'),
  ('account',   'Quote / renewal'),
  ('account',   'New contract')
ON CONFLICT (category, name) DO NOTHING;

-- ============================================================
-- TASKS
-- Core work item. Linked to one account + partner combination.
-- Multiple tasks can share the same account + partner.
-- Soft-delete: deleted_at is set instead of removing the row.
-- Non-admin API queries always filter WHERE deleted_at IS NULL.
-- ============================================================

CREATE TABLE tasks (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name        TEXT            NOT NULL,

  -- Account relationship (partner/distributor editable per task
  -- to support multi-partner scenarios on the same account)
  -- account_id nullable: tasks may start partner-only with no known end customer.
  -- "Link to account" sets account_id via PATCH /api/tasks/:id
  account_id       UUID            REFERENCES accounts(id) ON DELETE RESTRICT,
  partner_name     TEXT,                          -- nullable: no partner on some tasks
  distributor_name TEXT,

  -- Classification
  task_type_id     UUID            REFERENCES task_types(id) ON DELETE SET NULL,
  status           task_status     NOT NULL DEFAULT 'backlog',
  priority         task_priority   NOT NULL DEFAULT 'medium',
  eta              DATE,

  -- Execution
  next_action      TEXT,
  assignee_id      UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- External links (open in new tab)
  sfdc_task_url    TEXT,

  -- Future: Outlook plugin / SFDC integration hooks
  external_source  external_source NOT NULL DEFAULT 'manual',
  external_id      TEXT,                          -- Outlook message ID or SFDC task ID
  email_ref        TEXT,                          -- email message-id header

  -- Soft delete
  deleted_at       TIMESTAMPTZ,                   -- null = active
  deleted_by       UUID            REFERENCES users(id) ON DELETE SET NULL,

  -- Audit fields
  last_updated_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Indexes for the main filter/sort operations
CREATE INDEX idx_tasks_account_id    ON tasks(account_id);
CREATE INDEX idx_tasks_assignee_id   ON tasks(assignee_id);
CREATE INDEX idx_tasks_status        ON tasks(status);
CREATE INDEX idx_tasks_priority      ON tasks(priority);
CREATE INDEX idx_tasks_eta           ON tasks(eta);
CREATE INDEX idx_tasks_task_type_id  ON tasks(task_type_id);
CREATE INDEX idx_tasks_deleted_at    ON tasks(deleted_at);  -- fast active-only filter

-- ============================================================
-- TASK NOTES
-- Append-only timestamped log of notes per task.
-- Edit rules: only the original author may edit their note,
-- and only if no newer note exists on the same task.
-- Soft-delete mirrors tasks: cascade when parent task deleted.
-- ============================================================

CREATE TABLE task_notes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  content          TEXT        NOT NULL,           -- markdown supported
  last_updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  edited_at        TIMESTAMPTZ,                    -- null = never edited

  -- Soft delete (cascades from parent task deletion)
  deleted_at       TIMESTAMPTZ,                   -- null = active
  deleted_by       UUID        REFERENCES users(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_notes_task_id    ON task_notes(task_id);
CREATE INDEX idx_task_notes_deleted_at ON task_notes(deleted_at);

-- ============================================================
-- USER PREFERENCES
-- Per-user column layout and notes display settings.
-- ============================================================

CREATE TABLE user_preferences (
  user_id                     UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  column_order                JSONB   NOT NULL DEFAULT '[]',   -- ordered list of task column keys
  column_visibility           JSONB   NOT NULL DEFAULT '{}',   -- { column_key: true/false }
  notes_preview_count         INT     NOT NULL DEFAULT 2,      -- how many notes shown in inline preview
  accounts_column_order       JSONB   NOT NULL DEFAULT '[]',   -- same shape as column_order, for the accounts list
  accounts_column_visibility  JSONB   NOT NULL DEFAULT '{}',
  theme                       theme_preference                -- null = no saved preference, use OS setting
);

-- ============================================================
-- AUDIT LOG
-- Immutable record of all changes and view events.
-- Visible to admin role only (enforced at API layer).
-- ============================================================

CREATE TABLE audit_log (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT          NOT NULL,           -- 'task' | 'account' | 'task_note' | 'task_type' | 'user'
  entity_id      UUID          NOT NULL,
  user_id        UUID          REFERENCES users(id) ON DELETE SET NULL,
  action         audit_action  NOT NULL,
  changed_fields JSONB,                            -- { field: { from: x, to: y } } — null for 'viewed'
  timestamp      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity    ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user_id   ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- ============================================================
-- AUTO-UPDATE updated_at
-- Trigger keeps updated_at current on any row change.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- END OF SCHEMA
-- ============================================================
