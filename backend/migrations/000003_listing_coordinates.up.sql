ALTER TABLE profiles
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    ADD CONSTRAINT profiles_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT profiles_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

ALTER TABLE jobs
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    ADD CONSTRAINT jobs_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT jobs_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
