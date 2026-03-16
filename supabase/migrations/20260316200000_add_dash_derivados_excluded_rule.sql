-- ============================================================
-- MIGRATION: Add Derivados animales (id=20) as excluded for DASH
--
-- Previously group 20 was not mapped for DASH. Elevating it to
-- 'excluded' enables automatic substitution mappings for
-- embutidos, fiambres, mantequilla and other animal derivatives,
-- which are the main hidden-sodium source in the Western diet.
--
-- Affected diet: DASH (id=8)
-- New rule: food_group_id=20 (Derivados animales) → excluded
-- ============================================================

INSERT INTO public.diet_type_food_group_rules (diet_type_id, food_group_id, rule_type)
VALUES (8, 20, 'excluded')
ON CONFLICT (diet_type_id, food_group_id) DO UPDATE SET rule_type = 'excluded';
