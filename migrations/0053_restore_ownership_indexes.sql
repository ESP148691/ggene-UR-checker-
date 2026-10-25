-- 0053 所持テーブルの索引の復旧（2026-10-25 Coworkが本番D1のコンソールで適用済み）
--
-- 背景: 2026-10請求（9/24〜10/23）が $67.57 に膨らんだ。内訳の $56.43 は D1 の Rows Read 超過
--       （814億行読み込み、うち564億行が無料枠超え）。
--       本番の units_ownership / supporters_ownership に索引が1つも無く（0007で作るはずだった
--       一意索引が存在しなかった）、所持の照会・UPDATEのたびに表全体（約12万行）を読んでいた。
--       最も重かったのは推しキャラ候補の照会（characters_master × units_ownership の EXISTS）で、
--       1回あたり約770万行を読んでいた。
--
-- 適用前の確認: 重複行 0件（units_ownership 121,180行／supporters_ownership 32,699行）
-- 適用後の確認: EXPLAIN QUERY PLAN で
--   SEARCH o USING COVERING INDEX idx_units_ownership_user_unit (user_uid=? AND unit_id=?) を確認
--
-- 本番は適用済み。IF NOT EXISTS なので再実行しても問題ない。

CREATE UNIQUE INDEX IF NOT EXISTS idx_units_ownership_user_unit ON units_ownership(user_uid, unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supporters_ownership_user_supporter ON supporters_ownership(user_uid, supporter_id);
-- ユニット別の集計（所持者数のGROUP BYなど）用
CREATE INDEX IF NOT EXISTS idx_units_ownership_unit_user ON units_ownership(unit_id, user_uid);
