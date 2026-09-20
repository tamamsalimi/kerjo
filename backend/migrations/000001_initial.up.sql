CREATE TABLE users (
    user_id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    google_sub TEXT,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX user_sessions_user_id_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expires_at_idx ON user_sessions (expires_at);

CREATE TABLE profiles (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    experience_label TEXT NOT NULL DEFAULT 'Baru',
    availability TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    rate TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE jobs (
    id VARCHAR(64) PRIMARY KEY,
    owner_user_id VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    business TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    pay_amount INTEGER NOT NULL DEFAULT 0 CHECK (pay_amount >= 0),
    pay_unit TEXT NOT NULL DEFAULT '/hari',
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
    job_type TEXT NOT NULL DEFAULT 'Harian',
    min_experience_label TEXT NOT NULL DEFAULT 'Min. Tidak wajib',
    experience_bucket TEXT NOT NULL DEFAULT 'any',
    description TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    screening_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    workers_needed INTEGER NOT NULL DEFAULT 1 CHECK (workers_needed > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX jobs_owner_active_idx ON jobs (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX jobs_browse_idx ON jobs (category, job_type) WHERE deleted_at IS NULL;

CREATE TABLE workers (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    experience_label TEXT NOT NULL DEFAULT 'Baru',
    experience_years INTEGER NOT NULL DEFAULT 0,
    experience_bucket TEXT NOT NULL DEFAULT 'baru',
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    pay_amount INTEGER NOT NULL DEFAULT 0,
    pay_unit TEXT NOT NULL DEFAULT '',
    rating DOUBLE PRECISION NOT NULL DEFAULT 0,
    jobs_completed INTEGER NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_new BOOLEAN NOT NULL DEFAULT TRUE,
    avatar TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX workers_browse_idx ON workers (category) WHERE deleted_at IS NULL;

CREATE TABLE reviews (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(128) NOT NULL,
    match_id VARCHAR(64),
    reviewer_user_id VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    author TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    display_date TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX reviews_worker_id_idx ON reviews (worker_id);

CREATE TABLE swipes (
    id BIGSERIAL PRIMARY KEY,
    swiper_user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('job', 'worker')),
    target_id VARCHAR(128) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
    screening_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (swiper_user_id, target_type, target_id)
);
CREATE INDEX swipes_target_idx ON swipes (target_type, target_id, direction);
CREATE INDEX swipes_user_type_idx ON swipes (swiper_user_id, target_type);

CREATE TABLE matches (
    id VARCHAR(64) PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('bot', 'real')),
    user_id VARCHAR(64) REFERENCES users(user_id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id VARCHAR(128) NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    worker_user_id VARCHAR(64) REFERENCES users(user_id) ON DELETE CASCADE,
    employer_user_id VARCHAR(64) REFERENCES users(user_id) ON DELETE CASCADE,
    job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
    worker_name TEXT NOT NULL DEFAULT '',
    worker_category TEXT NOT NULL DEFAULT '',
    worker_avatar TEXT NOT NULL DEFAULT '',
    worker_phone TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    job_business TEXT NOT NULL DEFAULT '',
    job_category TEXT NOT NULL DEFAULT '',
    job_phone TEXT NOT NULL DEFAULT '',
    job_done BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX matches_bot_unique ON matches (user_id, entity_type, entity_id) WHERE kind = 'bot';
CREATE UNIQUE INDEX matches_real_unique ON matches (worker_user_id, employer_user_id, job_id) WHERE kind = 'real';
CREATE INDEX matches_job_id_idx ON matches (job_id) WHERE kind = 'real';

CREATE TABLE match_participants (
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (match_id, user_id)
);
CREATE INDEX match_participants_user_idx ON match_participants (user_id, match_id);

CREATE TABLE match_read_receipts (
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (match_id, user_id)
);

CREATE TABLE match_reviewers (
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, user_id)
);

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    legacy_id TEXT UNIQUE,
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender VARCHAR(64) NOT NULL,
    kind TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_match_created_idx ON messages (match_id, created_at, id);

CREATE TABLE message_schedules (
    id VARCHAR(64) PRIMARY KEY,
    message_id BIGINT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    when_text TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    proposed_by VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reviews
    ADD CONSTRAINT reviews_match_id_fk FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;
