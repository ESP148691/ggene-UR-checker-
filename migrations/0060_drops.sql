CREATE TABLE IF NOT EXISTS drop_stages (
  stage_id   INTEGER PRIMARY KEY,
  work_id    INTEGER NOT NULL,
  hard_no    INTEGER NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (work_id, hard_no)
);
CREATE TABLE IF NOT EXISTS drop_items (
  item_id    INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('book', 'part')),
  code       TEXT,
  name       TEXT NOT NULL,
  model_no   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drop_stage_items (
  stage_id   INTEGER NOT NULL,
  item_id    INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  checked_on TEXT,
  PRIMARY KEY (stage_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_drop_stage_items_item ON drop_stage_items(item_id);
