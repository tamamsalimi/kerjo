ALTER TABLE jobs
    DROP CONSTRAINT IF EXISTS jobs_longitude_check,
    DROP CONSTRAINT IF EXISTS jobs_latitude_check,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS latitude;

ALTER TABLE profiles
    DROP CONSTRAINT IF EXISTS profiles_longitude_check,
    DROP CONSTRAINT IF EXISTS profiles_latitude_check,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS latitude;
