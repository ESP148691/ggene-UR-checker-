ALTER TABLE units_effects ADD COLUMN src TEXT NOT NULL DEFAULT 'ex';
CREATE TABLE units_effects_new (
  rarity_code INTEGER NOT NULL,
  unit_id     INTEGER NOT NULL,
  effect_code TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  src         TEXT NOT NULL DEFAULT 'ex',
  PRIMARY KEY (rarity_code, unit_id, src, effect_code)
);
INSERT INTO units_effects_new (rarity_code, unit_id, effect_code, sort_order, src) SELECT rarity_code, unit_id, effect_code, sort_order, src FROM units_effects;
DROP TABLE units_effects;
ALTER TABLE units_effects_new RENAME TO units_effects;
