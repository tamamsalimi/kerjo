ALTER TABLE profiles
    ADD COLUMN last_education TEXT NOT NULL DEFAULT '';

ALTER TABLE workers
    ADD COLUMN last_education TEXT NOT NULL DEFAULT '';
