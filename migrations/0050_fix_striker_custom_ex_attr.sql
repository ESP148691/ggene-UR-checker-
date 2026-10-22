-- ストライカーカスタム（unit_id 3）のEX武装属性「特殊」が抜けていたので追加（物理＋特殊）。何度流してもよい
INSERT OR REPLACE INTO units_effects (rarity_code, unit_id, effect_code, sort_order) VALUES (1, 3, 'attr_physical', 1);
INSERT OR REPLACE INTO units_effects (rarity_code, unit_id, effect_code, sort_order) VALUES (1, 3, 'attr_special', 2);
