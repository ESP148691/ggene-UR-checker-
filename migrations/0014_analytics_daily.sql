CREATE TABLE IF NOT EXISTS analytics_daily (
  snap_date   TEXT    NOT NULL,
  kind        TEXT    NOT NULL,
  item_id     INTEGER NOT NULL,
  owned_count INTEGER NOT NULL,
  max_count   INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL,
  PRIMARY KEY (snap_date, kind, item_id)
);
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  snap_date       TEXT    PRIMARY KEY,
  accounts        INTEGER NOT NULL,
  unit_users      INTEGER NOT NULL,
  supporter_users INTEGER NOT NULL,
  er_users        INTEGER NOT NULL,
  created_at      TEXT    NOT NULL
);
