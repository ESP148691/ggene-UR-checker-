CREATE TABLE IF NOT EXISTS supporters_leader_rules (
  supporter_id INTEGER NOT NULL,
  rule_no      INTEGER NOT NULL,
  rate_lv0     INTEGER NOT NULL,
  rate_lv1     INTEGER,
  rate_lv2     INTEGER,
  rate_lv3     INTEGER NOT NULL,
  PRIMARY KEY (supporter_id, rule_no)
);
CREATE TABLE IF NOT EXISTS supporters_leader_targets (
  supporter_id INTEGER NOT NULL,
  rule_no      INTEGER NOT NULL,
  cond_no      INTEGER NOT NULL,
  target_kind  TEXT NOT NULL,
  target_id    INTEGER NOT NULL,
  PRIMARY KEY (supporter_id, rule_no, cond_no, target_kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_supporters_leader_targets_target ON supporters_leader_targets(target_kind, target_id);
CREATE TABLE IF NOT EXISTS user_formations (
  user_uid     TEXT NOT NULL,
  formation_no INTEGER NOT NULL,
  label        TEXT,
  supporter_id INTEGER,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_uid, formation_no)
);
CREATE TABLE IF NOT EXISTS user_formation_units (
  user_uid     TEXT NOT NULL,
  formation_no INTEGER NOT NULL,
  slot         INTEGER NOT NULL,
  rarity_code  INTEGER NOT NULL DEFAULT 1,
  unit_id      INTEGER NOT NULL,
  PRIMARY KEY (user_uid, formation_no, slot)
);
