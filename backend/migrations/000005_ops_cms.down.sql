DROP INDEX IF EXISTS reviews_hidden_idx;
DROP INDEX IF EXISTS jobs_hidden_idx;
DROP INDEX IF EXISTS users_suspended_idx;

ALTER TABLE reviews DROP COLUMN IF EXISTS hidden_reason;
ALTER TABLE reviews DROP COLUMN IF EXISTS hidden_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS hidden_reason;
ALTER TABLE jobs DROP COLUMN IF EXISTS hidden_at;
ALTER TABLE users DROP COLUMN IF EXISTS history_cleaned_at;
ALTER TABLE users DROP COLUMN IF EXISTS suspension_reason;
ALTER TABLE users DROP COLUMN IF EXISTS suspended_at;

DROP TABLE IF EXISTS admin_audit_logs;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS admin_users;
