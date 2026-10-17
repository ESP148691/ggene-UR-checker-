-- 新UR 2機の追加（2026-10-16 実装：ピックアップガシャ「機動戦士ガンダム00」）。データの出どころ：公式X・電撃オンライン・wikiwiki（我々はマチュであるが故に Wiki）・appmedia（2026-10-17調査）
--   88 リボーンズガンダム（限定・支援）／89 ガンダムデュナメス（恒常・攻撃）
-- 画像（images/units/88.jpg・89.jpg、images/characters/88.jpg・89.jpg）は運営者が用意してpushする。scan_fitは後で`/unit?scandebug=1`のUPDATE文を流す
-- 何度流してもよい（units_masterはOR IGNORE＋UPDATE。scan_fitを消さない）
INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (88, 'リボーンズガンダム', 1, '支援', '2026-10-16', NULL);
INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (89, 'ガンダムデュナメス', 0, '攻撃', '2026-10-16', NULL);
-- 射程（キャラ能力込みの最大）：リボーンズ＝TRANS-AM EXの1-5＋リボンズ(超一撃)の特殊武装+1＝6／デュナメス＝超高高度射撃砲EXの2-5＋ロックオン(HP満タン・超強気以上)のビーム武装+1＝2-6
UPDATE units_master SET range_min = 1, range_max = 6, range_note = NULL WHERE unit_id = 88;
UPDATE units_master SET range_min = 2, range_max = 6, range_note = NULL WHERE unit_id = 89;   -- ESP確認 10-17：EX武装は2-6
-- 効果アイコン：リボーンズ＝EX武装（TRANS-AM EX）のビーム被ダメ上昇＝支援のビームダメージ上昇（ESP確認 10-17。GNフィンファングの特殊被ダメ上昇は出さない）／デュナメス＝攻撃の属性武装（EX武装＝ビーム・特殊）
DELETE FROM units_effects WHERE rarity_code = 1 AND unit_id IN (88, 89);
INSERT INTO units_effects (rarity_code, unit_id, effect_code, sort_order) VALUES (1, 88, 'dmg_beam_up', 1), (1, 89, 'attr_beam', 1), (1, 89, 'attr_special', 2);
-- 作品：機動戦士ガンダム00（work_id 15）
INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, 88, 15), (1, 89, 15);
-- タグ（wikiの表記。運営者がゲーム内ユニット詳細で確認したら source を 'game' に直す）
--   リボーンズ：オルタナティブシリーズ58・ガンダム116・ライバル27・可変機5・アロウズ99・堅牢49・指揮官機135・白色14・不撓不屈50
--   デュナメス：オルタナティブシリーズ58・ガンダム116・専用機11・ソレスタルビーイング98・堅牢49・重撃136
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES
 (1, 88, 58, 'wiki', '2026-10-17'), (1, 88, 116, 'wiki', '2026-10-17'), (1, 88, 27, 'wiki', '2026-10-17'), (1, 88, 5, 'wiki', '2026-10-17'), (1, 88, 99, 'wiki', '2026-10-17'),
 (1, 88, 49, 'wiki', '2026-10-17'), (1, 88, 135, 'wiki', '2026-10-17'), (1, 88, 14, 'wiki', '2026-10-17'), (1, 88, 50, 'wiki', '2026-10-17'),
 (1, 89, 58, 'wiki', '2026-10-17'), (1, 89, 116, 'wiki', '2026-10-17'), (1, 89, 11, 'wiki', '2026-10-17'), (1, 89, 98, 'wiki', '2026-10-17'), (1, 89, 49, 'wiki', '2026-10-17'), (1, 89, 136, 'wiki', '2026-10-17');
-- セットのキャラ（56）：char_id＝unit_id
INSERT OR REPLACE INTO characters_master (char_id, name, set_rarity_code, set_unit_id, type, work_id) VALUES (88, 'リボンズ・アルマーク', 1, 88, NULL, NULL), (89, 'ロックオン・ストラトス', 1, 89, NULL, NULL);
