-- 75 ユニット一覧：UR機体とタグの突き合わせ（2026-10-17。wikiwiki「我々はマチュであるが故に Wiki」とESPのExcel（9/17）で照合）
-- Zガンダム(17)：2026-08-31の復刻で不撓不屈（tag_id 50）が追加された（ESP確認・wikiも同じ）
-- ガンダムアストレイ レッドフレーム改(54)・ゴールドフレーム天ミナ(55)：ライバル（tag_id 27）。ESPのExcelとwikiが一致
-- 何度流してもよい
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES (1, 17, 50, 'game', '2026-10-17');
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES (1, 54, 27, 'game', '2026-10-17');
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES (1, 55, 27, 'game', '2026-10-17');
