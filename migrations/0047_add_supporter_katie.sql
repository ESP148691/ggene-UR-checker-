-- 新URサポーター 51 カティ・マネキン&ウラル（恒常。2026-10-16 実装）。サポート効果＝範囲内の味方のHPを50%回復
-- リーダースキル（ESP確認 10-17）：指揮官機＝全ステータス(EN除く)+20%（完凸28%）／指揮官機かつライバル＝+30%（Lv0）→36→40→完凸44%（高い方が適用）
-- 画像 images/supporters/51.jpg は運営者が用意。scan_fitは後で`/supporter?scandebug=1`のUPDATE文を流す
-- タリア・グラディス&ミネルバ（32）は復刻のため変更なし（堅牢＋30%は登録済み）
-- 何度流してもよい（supporters_masterはOR IGNORE。scan_fitを消さない）
INSERT OR IGNORE INTO supporters_master (supporter_id, name, limited, skill) VALUES (51, 'カティ・マネキン&ウラル', 0, 'HP回復');
DELETE FROM supporters_leader_rules WHERE supporter_id = 51;
DELETE FROM supporters_leader_targets WHERE supporter_id = 51;
INSERT INTO supporters_leader_rules (supporter_id, rule_no, rate_lv0, rate_lv1, rate_lv2, rate_lv3) VALUES (51, 1, 20, NULL, NULL, 28), (51, 2, 30, 36, 40, 44);
INSERT INTO supporters_leader_targets (supporter_id, rule_no, cond_no, target_kind, target_id) VALUES
 (51, 1, 1, 'tag', 135),
 (51, 2, 1, 'tag', 135), (51, 2, 2, 'tag', 27);
