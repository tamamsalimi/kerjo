ALTER TABLE matches
    DROP COLUMN IF EXISTS job_allow_direct_call,
    DROP COLUMN IF EXISTS worker_allow_direct_call;

ALTER TABLE jobs DROP COLUMN IF EXISTS allow_direct_call;
ALTER TABLE profiles DROP COLUMN IF EXISTS allow_direct_call;
