ALTER TABLE new_unit_answers ADD COLUMN prev_level INTEGER;
CREATE TABLE IF NOT EXISTS new_unit_survey_summary (
  unit_id     INTEGER PRIMARY KEY,
  released_on TEXT    NOT NULL,
  answered    INTEGER NOT NULL,
  not_pulled  INTEGER NOT NULL,
  got         INTEGER NOT NULL,
  newly_got   INTEGER NOT NULL,
  level_up    INTEGER NOT NULL,
  lv0         INTEGER NOT NULL,
  lv1         INTEGER NOT NULL,
  lv2         INTEGER NOT NULL,
  lv3         INTEGER NOT NULL,
  retired_at  TEXT    NOT NULL
);
