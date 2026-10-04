ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS auth_rate_limits (rl_key TEXT PRIMARY KEY, window_start TEXT NOT NULL, fail_count INTEGER NOT NULL DEFAULT 0);
