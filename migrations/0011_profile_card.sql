CREATE TABLE IF NOT EXISTS works_master (work_id INTEGER PRIMARY KEY, era TEXT NOT NULL, universe TEXT NOT NULL, sort_order INTEGER NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, timeline_label TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS unit_work_map (unit_id INTEGER PRIMARY KEY, work_id INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS user_profiles (user_uid TEXT PRIMARY KEY, display_name TEXT, comment TEXT, title_mission_id INTEGER, card_template TEXT NOT NULL DEFAULT 'standard', card_theme TEXT NOT NULL DEFAULT 'galaxy', updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_favorite_works (user_uid TEXT NOT NULL, slot INTEGER NOT NULL, work_id INTEGER NOT NULL, PRIMARY KEY (user_uid, slot));
CREATE INDEX IF NOT EXISTS idx_fav_work ON user_favorite_works(work_id);
CREATE TABLE IF NOT EXISTS user_favorite_units (user_uid TEXT NOT NULL, slot INTEGER NOT NULL, unit_id INTEGER NOT NULL, PRIMARY KEY (user_uid, slot));
