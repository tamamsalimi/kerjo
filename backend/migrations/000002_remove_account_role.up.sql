ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_account_role_check,
    DROP COLUMN IF EXISTS role_registered_at,
    DROP COLUMN IF EXISTS account_role;
