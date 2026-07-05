-- Adds per-user column layout preferences for the accounts list (issue #9),
-- mirroring the existing tasks column_order/column_visibility pattern.
-- Separate columns rather than nesting under the existing ones — those are
-- already deployed and read as flat structures by Milestone 6 code; adding
-- new columns avoids reshaping data any existing user has already saved.
ALTER TABLE user_preferences
  ADD COLUMN accounts_column_order JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN accounts_column_visibility JSONB NOT NULL DEFAULT '{}';
