CREATE TABLE IF NOT EXISTS eternal_road_stage_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid TEXT NOT NULL,
  stage_id INTEGER NOT NULL,
  cleared_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(user_uid)
);

ALTER TABLE users ADD COLUMN eternal_road_first_registered_at TEXT;

INSERT INTO eternal_road_stage_clears (user_uid, stage_id, cleared_at)
SELECT c.user_uid, c.mission_id / 10, MIN(c.cleared_at)
FROM eternal_road_mission_clears c
WHERE NOT EXISTS (
  SELECT 1 FROM eternal_road_stage_clears s
  WHERE s.user_uid = c.user_uid AND s.stage_id = c.mission_id / 10
)
GROUP BY c.user_uid, c.mission_id / 10;

UPDATE users
SET eternal_road_first_registered_at = (
  SELECT MIN(cleared_at) FROM eternal_road_mission_clears c WHERE c.user_uid = users.user_uid
)
WHERE eternal_road_first_registered_at IS NULL
  AND EXISTS (SELECT 1 FROM eternal_road_mission_clears c WHERE c.user_uid = users.user_uid);
