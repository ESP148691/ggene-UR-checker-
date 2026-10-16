ALTER TABLE user_favorite_units ADD COLUMN char_id INTEGER;
ALTER TABLE ssr_units_master ADD COLUMN is_ult INTEGER NOT NULL DEFAULT 0;
