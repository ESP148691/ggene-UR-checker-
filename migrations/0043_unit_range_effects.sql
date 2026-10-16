ALTER TABLE units_master ADD COLUMN range_min INTEGER;
ALTER TABLE units_master ADD COLUMN range_max INTEGER;
ALTER TABLE units_master ADD COLUMN range_note TEXT;
CREATE TABLE IF NOT EXISTS effects_master (
  effect_code TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS units_effects (
  rarity_code INTEGER NOT NULL,
  unit_id     INTEGER NOT NULL,
  effect_code TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rarity_code, unit_id, effect_code)
);
