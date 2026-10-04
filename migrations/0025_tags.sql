
CREATE TABLE IF NOT EXISTS tags_master (
  tag_id      INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  applies_to  TEXT NOT NULL DEFAULT 'both',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags_master(name);

CREATE TABLE IF NOT EXISTS units_tags (
  rarity_code INTEGER NOT NULL,
  unit_id     INTEGER NOT NULL,
  tag_id      INTEGER NOT NULL,
  source      TEXT,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (rarity_code, unit_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_units_tags_tag ON units_tags(tag_id, rarity_code, unit_id);

CREATE VIEW IF NOT EXISTS v_all_units AS
  SELECT 1 AS rarity_code, u.unit_id, u.name, u.limited, u.type, m.work_id
  FROM units_master u
  LEFT JOIN unit_work_map m ON m.rarity_code = 1 AND m.unit_id = u.unit_id
  UNION ALL
  SELECT 2 AS rarity_code, s.unit_id, s.name, s.limited, s.type, m.work_id
  FROM ssr_units_master s
  LEFT JOIN unit_work_map m ON m.rarity_code = 2 AND m.unit_id = s.unit_id;
