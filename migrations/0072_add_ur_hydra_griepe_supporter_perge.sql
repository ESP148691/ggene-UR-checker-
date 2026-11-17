INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (92, 'ハイドラガンダム', 0, '攻撃', '2026-11-17', NULL);
INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (93, 'ガンダムグリープ', 0, '耐久', '2026-11-17', NULL);
UPDATE units_master SET range_min = 1, range_max = 4, range_note = NULL WHERE unit_id = 92;
UPDATE units_master SET range_min = 1, range_max = 4, range_note = NULL WHERE unit_id = 93;
DELETE FROM units_effects WHERE rarity_code = 1 AND unit_id IN (92, 93);
INSERT INTO units_effects (rarity_code, unit_id, effect_code, sort_order, src) VALUES (1, 92, 'attr_beam', 1, 'ex'), (1, 93, 'wpn_beam_down', 1, 'ex'), (1, 93, 'wpn_special_down', 1, 'sub');
INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, 92, 64), (1, 93, 64);
INSERT OR IGNORE INTO tags_master (tag_id, name, category, applies_to, sort_order, is_active, short_name) VALUES (144, 'PXシステム', 'システム', 'unit', 614, 1, NULL);
DELETE FROM units_tags WHERE rarity_code = 1 AND unit_id IN (92, 93) AND source = 'wiki';
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES
 (1, 92, 58, 'wiki', '2026-11-18'), (1, 92, 116, 'wiki', '2026-11-18'), (1, 92, 115, 'wiki', '2026-11-18'), (1, 92, 27, 'wiki', '2026-11-18'), (1, 92, 8, 'wiki', '2026-11-18'), (1, 92, 5, 'wiki', '2026-11-18'),
 (1, 92, 122, 'wiki', '2026-11-18'), (1, 92, 47, 'wiki', '2026-11-18'), (1, 92, 137, 'wiki', '2026-11-18'), (1, 92, 135, 'wiki', '2026-11-18'), (1, 92, 13, 'wiki', '2026-11-18'), (1, 92, 136, 'wiki', '2026-11-18'),
 (1, 93, 58, 'wiki', '2026-11-18'), (1, 93, 116, 'wiki', '2026-11-18'), (1, 93, 26, 'wiki', '2026-11-18'), (1, 93, 8, 'wiki', '2026-11-18'), (1, 93, 5, 'wiki', '2026-11-18'), (1, 93, 142, 'wiki', '2026-11-18'),
 (1, 93, 49, 'wiki', '2026-11-18'), (1, 93, 137, 'wiki', '2026-11-18'), (1, 93, 134, 'wiki', '2026-11-18'), (1, 93, 45, 'wiki', '2026-11-18'), (1, 93, 144, 'wiki', '2026-11-18');
INSERT OR REPLACE INTO characters_master (char_id, name, set_rarity_code, set_unit_id, type, work_id) VALUES (92, 'ヴァルダー・ファーキル', 1, 92, NULL, NULL), (93, 'アディン・バーネット', 1, 93, NULL, NULL);
INSERT OR IGNORE INTO supporters_master (supporter_id, name, limited, skill) VALUES (53, 'ドクター・ペルゲ&グランシャリオ', 0, 'HP回復');
DELETE FROM supporters_leader_rules WHERE supporter_id = 53;
DELETE FROM supporters_leader_targets WHERE supporter_id = 53;
INSERT INTO supporters_leader_rules (supporter_id, rule_no, rate_lv0, rate_lv1, rate_lv2, rate_lv3) VALUES (53, 1, 25, 30, 33, 36);
INSERT INTO supporters_leader_targets (supporter_id, rule_no, cond_no, target_kind, target_id) VALUES (53, 1, 1, 'tag', 13);
