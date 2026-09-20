ALTER TABLE users
    ADD COLUMN account_role TEXT NOT NULL DEFAULT '',
    ADD COLUMN role_registered_at TIMESTAMPTZ,
    ADD CONSTRAINT users_account_role_check CHECK (account_role IN ('', 'job_seeker', 'employer'));
