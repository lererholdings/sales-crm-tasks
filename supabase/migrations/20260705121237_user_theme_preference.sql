-- Persists the theme toggle to the DB so it syncs across devices (issue:
-- Milestone 7). Nullable with no default — null specifically means "the
-- user has never chosen one," which is what tells the frontend to fall
-- back to the OS prefers-color-scheme setting instead of forcing a value.
CREATE TYPE theme_preference AS ENUM ('light', 'dark');

ALTER TABLE user_preferences
  ADD COLUMN theme theme_preference;
