CREATE TABLE user_verifications (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    phone VARCHAR(32) NOT NULL DEFAULT '',
    nik VARCHAR(16) NOT NULL DEFAULT '',
    ktp_photo_path TEXT NOT NULL DEFAULT '',
    face_photo_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unverified',
    rejection_reason TEXT NOT NULL DEFAULT '',
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_verifications_status_check
        CHECK (status IN ('unverified', 'pending', 'approved', 'rejected')),
    CONSTRAINT user_verifications_nik_check
        CHECK (nik = '' OR nik ~ '^[0-9]{16}$')
);

CREATE UNIQUE INDEX user_verifications_nik_unique
    ON user_verifications (nik)
    WHERE nik <> '';

CREATE INDEX user_verifications_status_submitted_idx
    ON user_verifications (status, submitted_at DESC);
