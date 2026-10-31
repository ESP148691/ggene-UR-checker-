INSERT OR IGNORE INTO supporters_master (supporter_id, name, limited, skill) VALUES (52, 'マリーダ・クルス&ガランシェール', 0, 'HP回復');
DELETE FROM supporters_leader_rules WHERE supporter_id = 52;
DELETE FROM supporters_leader_targets WHERE supporter_id = 52;
INSERT INTO supporters_leader_rules (supporter_id, rule_no, rate_lv0, rate_lv1, rate_lv2, rate_lv3) VALUES (52, 1, 25, 30, 33, 36);
INSERT INTO supporters_leader_targets (supporter_id, rule_no, cond_no, target_kind, target_id) VALUES (52, 1, 1, 'tag', 12);
