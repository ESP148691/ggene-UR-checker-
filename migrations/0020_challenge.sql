CREATE TABLE IF NOT EXISTS challenge_series (
  series_code  INTEGER PRIMARY KEY,
  series_name  TEXT NOT NULL,
  short_name   TEXT NOT NULL,
  work_id      INTEGER,
  sort_order   INTEGER NOT NULL,
  released_on  TEXT
);

CREATE TABLE IF NOT EXISTS challenge_stages (
  stage_id     INTEGER PRIMARY KEY,
  series_code  INTEGER NOT NULL,
  difficulty   TEXT NOT NULL DEFAULT 'HARD',
  stage_no     INTEGER NOT NULL,
  stage_label  TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  confidence   TEXT NOT NULL,
  FOREIGN KEY (series_code) REFERENCES challenge_series(series_code)
);
CREATE INDEX IF NOT EXISTS idx_challenge_stages_series ON challenge_stages(series_code);

CREATE TABLE IF NOT EXISTS challenge_missions (
  mission_id      INTEGER PRIMARY KEY,
  stage_id        INTEGER NOT NULL,
  mission_slot    INTEGER NOT NULL,
  mission_type    TEXT NOT NULL,
  mission_text    TEXT NOT NULL,
  reward          TEXT NOT NULL,
  tag_id          INTEGER,
  tag_name        TEXT,
  param           TEXT,
  short_label     TEXT,
  includes_secret INTEGER NOT NULL DEFAULT 0,
  confidence      TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  FOREIGN KEY (stage_id) REFERENCES challenge_stages(stage_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_missions_stage ON challenge_missions(stage_id);

CREATE TABLE IF NOT EXISTS challenge_mission_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  mission_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);
CREATE INDEX IF NOT EXISTS idx_challenge_mission_clears_user ON challenge_mission_clears(user_uid);

CREATE TABLE IF NOT EXISTS challenge_stage_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  stage_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);
CREATE INDEX IF NOT EXISTS idx_challenge_stage_clears_user ON challenge_stage_clears(user_uid);

ALTER TABLE users ADD COLUMN challenge_first_registered_at TEXT;
