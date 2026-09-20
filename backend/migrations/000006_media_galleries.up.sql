ALTER TABLE profiles
    ADD COLUMN photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE profiles
SET photo_urls = jsonb_build_array(photo_url)
WHERE photo_url <> '';

ALTER TABLE jobs
    ADD COLUMN photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
