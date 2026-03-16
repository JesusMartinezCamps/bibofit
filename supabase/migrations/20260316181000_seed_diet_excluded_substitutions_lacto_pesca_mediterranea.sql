-- ============================================================
-- MIGRATION: Seed automatic substitution mappings for 3 diets
--   - Lactovegetariana
--   - Pescetariana
--   - Mediterránea
--
-- Rules:
-- - Only rule_type = 'excluded' is mapped.
-- - rule_type = 'limited' is intentionally ignored.
-- - Upsert behavior by (source, target, context_key).
-- ============================================================

WITH diet_contexts AS (
  SELECT
    dt.id AS diet_type_id,
    dt.name AS diet_type_name,
    r.food_group_id,
    fg.name AS food_group_name
  FROM public.diet_types dt
  JOIN public.diet_type_food_group_rules r
    ON r.diet_type_id = dt.id
  JOIN public.food_groups fg
    ON fg.id = r.food_group_id
  WHERE dt.name IN ('Lactovegetariana', 'Pescetariana', 'Mediterránea')
    AND r.rule_type = 'excluded'
    AND r.food_group_id IN (13, 14, 15, 16, 17, 18, 21)
),
source_foods AS (
  SELECT
    dc.diet_type_id,
    dc.diet_type_name,
    dc.food_group_id,
    dc.food_group_name,
    f.id AS source_food_id,
    f.name AS source_food_name,
    translate(
      lower(f.name),
      'áàäâéèëêíìïîóòöôúùüûñç',
      'aaaaeeeeiiiioooouuuunc'
    ) AS source_name_norm,
    format('diet_type:%s:excluded:%s', dc.diet_type_id, dc.food_group_id) AS context_key
  FROM diet_contexts dc
  JOIN public.food_to_food_groups ffg
    ON ffg.food_group_id = dc.food_group_id
  JOIN public.food f
    ON f.id = ffg.food_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Tofu',
    'Tempeh',
    'Soja texturizada',
    'Almendra',
    'Nueces',
    'Plátano',
    'Avena',
    'Yogur natural'
  )
),
candidate_rows_raw AS (
  -- Carnes blancas -> tofu/tempeh/soja texturizada
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 95::numeric, 1),
      ('Tempeh', 90::numeric, 2),
      ('Soja texturizada', 85::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 13

  UNION ALL

  -- Carnes rojas -> soja texturizada/tempeh/tofu
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Soja texturizada', 95::numeric, 1),
      ('Tempeh', 90::numeric, 2),
      ('Tofu', 85::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 14

  UNION ALL

  -- Pescados blancos -> tofu/tempeh
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 95::numeric, 1),
      ('Tempeh', 90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 15

  UNION ALL

  -- Pescados azules -> tofu/tempeh
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 95::numeric, 1),
      ('Tempeh', 90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 16

  UNION ALL

  -- Mariscos y moluscos -> tempeh/tofu
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tempeh', 95::numeric, 1),
      ('Tofu', 90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 17

  UNION ALL

  -- Huevos (Lactovegetariana) -> tofu/tempeh
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 95::numeric, 1),
      ('Tempeh', 90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 18

  UNION ALL

  -- Mediterranea: ultraprocesados -> alternativas simples
  -- chocolate* -> frutos secos
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
      ('Nueces', 92::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND sf.source_name_norm LIKE '%chocolate%'

  UNION ALL

  -- galletas/picatostes -> avena + frutos secos
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Avena', 94::numeric, 1),
      ('Almendra', 91::numeric, 2),
      ('Nueces', 89::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND (sf.source_name_norm LIKE '%galleta%' OR sf.source_name_norm LIKE '%picatoste%')

  UNION ALL

  -- delicias de pollo/procesado animal -> tofu/tempeh
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 94::numeric, 1),
      ('Tempeh', 90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND sf.source_name_norm LIKE '%pollo%'

  UNION ALL

  -- fallback ultraprocesados
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Almendra', 92::numeric, 1),
      ('Nueces', 90::numeric, 2),
      ('Plátano', 88::numeric, 3),
      ('Yogur natural', 86::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND sf.source_name_norm NOT LIKE '%chocolate%'
    AND sf.source_name_norm NOT LIKE '%galleta%'
    AND sf.source_name_norm NOT LIKE '%picatoste%'
    AND sf.source_name_norm NOT LIKE '%pollo%'
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
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score = c.confidence_score,
    reason = c.reason,
    is_automatic = true,
    metadata = jsonb_build_object(
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
  WHERE fsm.source_food_id = c.source_food_id
    AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id
      AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  )
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows) AS updated_rows_count,
  (SELECT COUNT(*) FROM inserted_rows) AS inserted_rows_count;
