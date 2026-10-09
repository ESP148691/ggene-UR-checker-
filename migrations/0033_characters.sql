CREATE TABLE IF NOT EXISTS characters_master (
  char_id         INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  set_rarity_code INTEGER,
  set_unit_id     INTEGER,
  type            TEXT,
  work_id         INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_set_unit ON characters_master(set_rarity_code, set_unit_id);
CREATE TABLE IF NOT EXISTS user_favorite_characters (
  user_uid TEXT NOT NULL,
  slot     INTEGER NOT NULL,
  char_id  INTEGER NOT NULL,
  PRIMARY KEY (user_uid, slot)
);
ALTER TABLE user_formation_units ADD COLUMN pilot_char_id INTEGER;
UPDATE user_formation_units SET pilot_char_id = unit_id WHERE pilot_char_id IS NULL AND rarity_code = 1;
