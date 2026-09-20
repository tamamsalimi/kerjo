CREATE TABLE admin_users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'moderator', 'reviewer')),
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_sessions (
    id BIGSERIAL PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET
);
CREATE INDEX admin_sessions_admin_idx ON admin_sessions (admin_user_id);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at);

CREATE TABLE admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX admin_audit_logs_admin_created_idx ON admin_audit_logs (admin_user_id, created_at DESC);
CREATE INDEX admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id, created_at DESC);

ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN suspension_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN history_cleaned_at TIMESTAMPTZ;

ALTER TABLE jobs ADD COLUMN hidden_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN hidden_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE reviews ADD COLUMN hidden_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN hidden_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX users_suspended_idx ON users (suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX jobs_hidden_idx ON jobs (hidden_at) WHERE hidden_at IS NOT NULL;
CREATE INDEX reviews_hidden_idx ON reviews (hidden_at) WHERE hidden_at IS NOT NULL;
