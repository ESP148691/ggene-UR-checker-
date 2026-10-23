CREATE TABLE IF NOT EXISTS new_unit_answers (
  user_uid    TEXT    NOT NULL,
  unit_id     INTEGER NOT NULL,
  answer      TEXT    NOT NULL CHECK (answer IN ('not_pulled', 'got')),
  level       INTEGER CHECK (level IS NULL OR level BETWEEN 0 AND 3),
  answered_at TEXT    NOT NULL,
  PRIMARY KEY (user_uid, unit_id)
);
CREATE INDEX IF NOT EXISTS idx_new_unit_answers_unit ON new_unit_answers(unit_id);
