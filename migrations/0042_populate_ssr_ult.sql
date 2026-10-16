UPDATE ssr_units_master SET is_ult = 0 WHERE is_ult <> 0 AND unit_id NOT IN (27, 61, 68, 71, 85, 95, 98, 121, 163, 164, 190, 252, 283, 285, 298, 324);
UPDATE ssr_units_master SET is_ult = 1 WHERE unit_id IN (27, 61, 68, 71, 85, 95, 98, 121, 163, 164, 190, 252, 283, 285, 298, 324);
