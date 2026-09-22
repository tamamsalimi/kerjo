ALTER TABLE profiles
    ADD COLUMN employer_type TEXT NOT NULL DEFAULT 'pribadi'
    CHECK (employer_type IN ('pribadi', 'usaha_perusahaan'));

ALTER TABLE jobs
    ADD COLUMN employer_type TEXT NOT NULL DEFAULT 'pribadi'
    CHECK (employer_type IN ('pribadi', 'usaha_perusahaan'));

UPDATE jobs
SET employer_type = 'usaha_perusahaan'
WHERE id IN ('jb_2', 'jb_4', 'jb_5', 'jb_7', 'jb_8', 'jb_10');
