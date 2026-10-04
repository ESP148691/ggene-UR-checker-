
ALTER TABLE user_favorite_units ADD COLUMN rarity_code INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS ssr_units_master (
  unit_id INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  limited INTEGER NOT NULL DEFAULT 0,
  type    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ssr_units_name_type ON ssr_units_master(name, type);

CREATE TABLE unit_work_map_new (
  rarity_code INTEGER NOT NULL,
  unit_id     INTEGER NOT NULL,
  work_id     INTEGER NOT NULL,
  PRIMARY KEY (rarity_code, unit_id)
);
INSERT INTO unit_work_map_new (rarity_code, unit_id, work_id) SELECT 1, unit_id, work_id FROM unit_work_map;
DROP TABLE unit_work_map;
ALTER TABLE unit_work_map_new RENAME TO unit_work_map;
CREATE INDEX IF NOT EXISTS idx_unit_work_map_work ON unit_work_map(work_id);
