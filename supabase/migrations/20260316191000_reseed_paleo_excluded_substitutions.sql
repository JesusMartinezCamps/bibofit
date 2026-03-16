-- ============================================================
-- MIGRATION: Re-seed Paleo excluded substitutions with variety
--
-- Requested mapping logic for Paleo:
-- - Legumbres -> carnes / pescados / huevos / frutos secos
-- - Cereales -> tuberculos / frutas / verduras
-- - Lacteos -> frutos secos / coco / pescados azules
-- - Ultraprocesados -> frutas
-- - Pseudocereales -> tuberculos
-- - Panes y pastas -> tuberculos o calabaza
-- - Carbohidrato simple -> frutas
--
-- Scope:
-- - diet_type = Paleo
-- - only excluded groups
-- - deletes previous mappings for these Paleo excluded contexts,
--   then inserts deterministic varied candidates.
-- ============================================================

WITH paleo AS (
  SELECT id AS diet_type_id, name AS diet_type_name
  FROM public.diet_types
  WHERE name = 'Paleo'
  LIMIT 1
),
excluded_contexts AS (
  SELECT
    p.diet_type_id,
    p.diet_type_name,
    r.food_group_id,
    fg.name AS food_group_name,
    format('diet_type:%s:excluded:%s', p.diet_type_id, r.food_group_id) AS context_key
  FROM paleo p
  JOIN public.diet_type_food_group_rules r
    ON r.diet_type_id = p.diet_type_id
   AND r.rule_type = 'excluded'
  JOIN public.food_groups fg
    ON fg.id = r.food_group_id
  WHERE r.food_group_id IN (3, 6, 19, 21, 26, 30, 31, 35)
),
source_foods AS (
  SELECT
    ec.diet_type_id,
    ec.diet_type_name,
    ec.food_group_id,
    ec.food_group_name,
    ec.context_key,
    f.id AS source_food_id,
    f.name AS source_food_name
  FROM excluded_contexts ec
  JOIN public.food_to_food_groups ffg
    ON ffg.food_group_id = ec.food_group_id
  JOIN public.food f
    ON f.id = ffg.food_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    -- meats / fish / eggs / nuts
    'Pechuga de Pollo',
    'Ternera Picada',
    'Salmón',
    'Merluza',
    'Huevo L',
    'Almendra',
    'Nueces',
    -- tubers / fruits / vegetables
    'Boniato',
    'Yuca',
    'Plátano',
    'Manzana Grande',
    'Naranja',
    'Calabaza',
    'Brócoli',
    -- dairy alternatives requested
    'Coco rallado',
    'Sardinas en lata'
  )
),
candidate_rows_raw AS (
  -- Legumbres -> carnes / pescados / huevos / frutos secos
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Pechuga de Pollo', 95::numeric, 1),
      ('Salmón', 94::numeric, 2),
      ('Huevo L', 92::numeric, 3),
      ('Almendra', 90::numeric, 4),
      ('Nueces', 89::numeric, 5),
      ('Merluza', 88::numeric, 6),
      ('Ternera Picada', 87::numeric, 7)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 3

  UNION ALL

  -- Cereales -> tuberculos / frutas / verduras
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Boniato', 95::numeric, 1),
      ('Yuca', 93::numeric, 2),
      ('Calabaza', 92::numeric, 3),
      ('Plátano', 90::numeric, 4),
      ('Manzana Grande', 88::numeric, 5),
      ('Brócoli', 87::numeric, 6)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 6

  UNION ALL

  -- Lacteos -> frutos secos / coco / pescados azules
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Almendra', 95::numeric, 1),
      ('Nueces', 93::numeric, 2),
      ('Coco rallado', 92::numeric, 3),
      ('Salmón', 90::numeric, 4),
      ('Sardinas en lata', 88::numeric, 5)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19

  UNION ALL

  -- Ultraprocesados -> frutas
  SELECT
    sf.*,
    tc.id AS target_food_id,
    tc.name AS target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Plátano', 95::numeric, 1),
      ('Manzana Grande', 93::numeric, 2),
      ('Naranja', 91::numeric, 3),
      ('Fresa', 89::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN public.food tc
    ON tc.name = pref.target_food_name
  WHERE sf.food_group_id = 21

  UNION ALL

  -- Pseudocereales -> tuberculos
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Boniato', 95::numeric, 1),
      ('Yuca', 93::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 26

  UNION ALL

  -- Panes -> tuberculos o calabaza
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Boniato', 95::numeric, 1),
      ('Yuca', 93::numeric, 2),
      ('Calabaza', 91::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 30

  UNION ALL

  -- Pastas -> tuberculos o calabaza
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Boniato', 95::numeric, 1),
      ('Yuca', 93::numeric, 2),
      ('Calabaza', 91::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 31

  UNION ALL

  -- Carbohidrato simple -> frutas
  SELECT
    sf.*,
    tc.id AS target_food_id,
    tc.name AS target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Plátano', 95::numeric, 1),
      ('Manzana Grande', 93::numeric, 2),
      ('Naranja', 91::numeric, 3),
      ('Fresa', 89::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN public.food tc
    ON tc.name = pref.target_food_name
  WHERE sf.food_group_id = 35
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    diet_type_id,
    diet_type_name,
    food_group_id,
    food_group_name,
    source_food_id,
    source_food_name,
    target_food_id,
    target_food_name,
    confidence_score,
    preference_rank,
    context_key,
    format(
      '%s en conflicto con Dieta (No compatible): %s · %s. Se reemplaza por %s.',
      source_food_name,
      diet_type_name,
      food_group_name,
      target_food_name
    ) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
deleted_rows AS (
  DELETE FROM public.food_substitution_mappings fsm
  USING excluded_contexts ec
  WHERE COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = ec.context_key
  RETURNING fsm.id
),
creator AS (
  SELECT p.user_id
  FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id
  LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id,
    target_food_id,
    substitution_type,
    confidence_score,
    reason,
    is_automatic,
    created_by,
    metadata
  )
  SELECT
    c.source_food_id,
    c.target_food_id,
    'allergen_safe',
    c.confidence_score,
    c.reason,
    true,
    cr.user_id,
    jsonb_build_object(
      'context_key', c.context_key,
      'conflict_contexts',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'diet_type',
          'diet_type_id', c.diet_type_id,
          'diet_type_name', c.diet_type_name,
          'food_group_id', c.food_group_id,
          'food_group_name', c.food_group_name,
          'rule_type', 'excluded'
        )
      )
    )
  FROM candidate_rows c
  JOIN creator cr
    ON true
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM deleted_rows) AS deleted_rows_count,
  (SELECT COUNT(*) FROM inserted_rows) AS inserted_rows_count;
