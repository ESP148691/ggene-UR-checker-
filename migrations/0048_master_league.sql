CREATE TABLE IF NOT EXISTS ml_seasons (
  season_code TEXT PRIMARY KEY,
  name        TEXT,
  starts_on   TEXT NOT NULL,
  ends_on     TEXT,
  stage       TEXT,
  note        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ml_season_targets (
  season_code TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('tag', 'work')),
  target_id   INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (season_code, target_kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_ml_seasons_starts ON ml_seasons(starts_on);
