-- 0054 エタロのクリア記録TBLの索引（84 D1読み込み超過の対策）
--
-- 背景: eternal_road_mission_clears / eternal_road_stage_clears に索引が1つも無く、
--       ミッション・ステージごとの達成者数（COUNT(DISTINCT c.user_uid) … WHERE c.mission_id = ?）や
--       ユーザーごとの照会（WHERE user_uid = ?）のたびに表全体を読んでいた。
-- 登録は「ユーザーの行を全部DELETE→INSERT」なので一意索引にはしない。
-- データは変えない。IF NOT EXISTS なので何度実行してもよい。

CREATE INDEX IF NOT EXISTS idx_er_mission_clears_user    ON eternal_road_mission_clears(user_uid, mission_id);
CREATE INDEX IF NOT EXISTS idx_er_mission_clears_mission ON eternal_road_mission_clears(mission_id, user_uid);
CREATE INDEX IF NOT EXISTS idx_er_stage_clears_user      ON eternal_road_stage_clears(user_uid, stage_id);
CREATE INDEX IF NOT EXISTS idx_er_stage_clears_stage     ON eternal_road_stage_clears(stage_id, user_uid);

-- ---- 適用後の確認（4本出ればOK） ----
-- SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'eternal_road_%_clears';
