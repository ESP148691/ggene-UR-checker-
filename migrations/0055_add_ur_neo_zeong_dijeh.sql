INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (90, 'ネオ・ジオング', 1, '耐久', '2026-10-31', NULL);
INSERT OR IGNORE INTO units_master (unit_id, name, limited, type, released_on, wrap) VALUES (91, 'ディジェ(シャア・アズナブル機)', 0, '攻撃', '2026-10-31', 'ディジェ|(シャア・アズナブル機)');
UPDATE units_master SET range_min = 2, range_max = 5, range_note = NULL WHERE unit_id = 90;
UPDATE units_master SET range_min = 1, range_max = 4, range_note = NULL WHERE unit_id = 91;
DELETE FROM units_effects WHERE rarity_code = 1 AND unit_id IN (90, 91);
INSERT INTO units_effects (rarity_code, unit_id, effect_code, sort_order) VALUES (1, 90, 'atk_down', 1), (1, 91, 'attr_beam', 1), (1, 91, 'attr_special', 2);
INSERT OR REPLACE INTO unit_work_map (rarity_code, unit_id, work_id) VALUES (1, 90, 5), (1, 91, 48);
DELETE FROM units_tags WHERE rarity_code = 1 AND unit_id IN (90, 91) AND source = 'wiki';
INSERT OR REPLACE INTO units_tags (rarity_code, unit_id, tag_id, source, updated_at) VALUES
 (1, 90, 57, 'wiki', '2026-10-31'), (1, 90, 115, 'wiki', '2026-10-31'), (1, 90, 27, 'wiki', '2026-10-31'), (1, 90, 8, 'wiki', '2026-10-31'), (1, 90, 32, 'wiki', '2026-10-31'),
 (1, 90, 80, 'wiki', '2026-10-31'), (1, 90, 48, 'wiki', '2026-10-31'), (1, 90, 135, 'wiki', '2026-10-31'), (1, 90, 12, 'wiki', '2026-10-31'), (1, 90, 136, 'wiki', '2026-10-31'),
 (1, 91, 57, 'wiki', '2026-10-31'), (1, 91, 115, 'wiki', '2026-10-31'), (1, 91, 32, 'wiki', '2026-10-31'), (1, 91, 80, 'wiki', '2026-10-31'), (1, 91, 46, 'wiki', '2026-10-31'),
 (1, 91, 18, 'wiki', '2026-10-31'), (1, 91, 12, 'wiki', '2026-10-31'), (1, 91, 50, 'wiki', '2026-10-31');
INSERT OR REPLACE INTO characters_master (char_id, name, set_rarity_code, set_unit_id, type, work_id) VALUES (90, 'フル・フロンタル', 1, 90, NULL, NULL), (91, 'シャア・アズナブル', 1, 91, NULL, NULL);
