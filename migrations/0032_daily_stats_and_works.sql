CREATE TABLE IF NOT EXISTS daily_stats (
  stat_date TEXT NOT NULL,
  stat_key  TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, stat_key)
);
UPDATE unit_work_map SET work_id = 23 WHERE rarity_code = 1 AND unit_id = 50;
UPDATE unit_work_map SET work_id = 106 WHERE rarity_code = 1 AND unit_id IN (68, 86);
