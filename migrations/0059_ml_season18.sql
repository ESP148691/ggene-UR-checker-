INSERT OR REPLACE INTO ml_seasons (season_code, name, starts_on, ends_on, stage, note, is_active, updated_at) VALUES ('18', NULL, '2026-11-23', NULL, NULL, '期間未定', 1, '2026-10-31');
DELETE FROM ml_season_targets WHERE season_code = '18';
INSERT INTO ml_season_targets (season_code, target_kind, target_id, sort_order) SELECT '18', 'tag', tag_id, 1 FROM tags_master WHERE name = '赤色' AND is_active = 1;
INSERT INTO ml_season_targets (season_code, target_kind, target_id, sort_order) SELECT '18', 'tag', tag_id, 2 FROM tags_master WHERE name = '突破力' AND is_active = 1;
