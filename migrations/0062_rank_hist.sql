CREATE TABLE IF NOT EXISTS rank_hist (
  snap_date TEXT    NOT NULL,
  metric    TEXT    NOT NULL,
  value     INTEGER NOT NULL,
  users     INTEGER NOT NULL,
  PRIMARY KEY (snap_date, metric, value)
);
