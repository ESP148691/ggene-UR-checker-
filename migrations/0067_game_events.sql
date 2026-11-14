CREATE TABLE IF NOT EXISTS game_events (
  event_id   INTEGER PRIMARY KEY,
  kind       TEXT    NOT NULL CHECK (kind IN ('gacha', 'story', 'raid', 'tower', 'ml', 'campaign', 'update')),
  title      TEXT    NOT NULL,
  sub_title  TEXT,
  starts_at  TEXT    NOT NULL,
  ends_at    TEXT,
  date_fixed INTEGER NOT NULL DEFAULT 1,
  when_label TEXT,
  source_ref TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_events_ends ON game_events(is_active, ends_at);
CREATE TABLE IF NOT EXISTS game_event_items (
  event_id   INTEGER NOT NULL,
  item_kind  TEXT    NOT NULL CHECK (item_kind IN ('unit', 'supporter')),
  item_id    INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (event_id, item_kind, item_id)
);
