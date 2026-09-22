CREATE TABLE eternal_road_missions (
  mission_id INTEGER PRIMARY KEY,
  stage_id INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  mission_slot INTEGER NOT NULL,
  mission_type TEXT NOT NULL,
  mission_text TEXT NOT NULL,
  reward TEXT NOT NULL,
  is_title INTEGER NOT NULL DEFAULT 0,
  tag TEXT,
  title_name TEXT,
  confidence TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE eternal_road_mission_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  mission_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid),
  FOREIGN KEY (mission_id) REFERENCES eternal_road_missions(mission_id)
);
