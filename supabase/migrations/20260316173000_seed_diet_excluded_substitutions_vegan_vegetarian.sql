-- ============================================================
-- MIGRATION: Seed automatic substitution mappings
-- for excluded food groups in:
--   - Vegana Estricta
--   - Vegetariana Estricta
--
-- IMPORTANT:
-- - Only rule_type = 'excluded' is considered.
-- - rule_type = 'limited' is intentionally ignored.
-- - Inserts are idempotent by (source, target, context_key).
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
  WHERE dt.name IN ('Vegana Estricta', 'Vegetariana Estricta')
    AND r.rule_type = 'excluded'
    AND r.food_group_id IN (13, 14, 15, 16, 17, 18, 19, 20)
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
    'Yogur Soja',
    'Bebida de Soja',
    'Bebida de Avena',
    'Bebida de Arroz',
    'Bebida de Avellana',
    'Aceite de coco',
    'Stevia'
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

  -- Huevos (solo vegana estricta) -> tofu/tempeh
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

  -- Lacteos: yogur/kefir -> yogur soja + bebidas vegetales
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Yogur Soja', 96::numeric, 1),
      ('Bebida de Soja', 90::numeric, 2),
      ('Bebida de Avena', 88::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19
    AND (sf.source_name_norm LIKE '%yogur%' OR sf.source_name_norm LIKE '%kefir%')

  UNION ALL

  -- Lacteos: leche -> bebidas vegetales
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Bebida de Soja', 96::numeric, 1),
      ('Bebida de Avena', 93::numeric, 2),
      ('Bebida de Arroz', 90::numeric, 3),
      ('Bebida de Avellana', 88::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19
    AND sf.source_name_norm LIKE '%leche%'

  UNION ALL

  -- Lacteos: queso -> tofu/tempeh
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 93::numeric, 1),
      ('Tempeh', 88::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19
    AND sf.source_name_norm LIKE '%queso%'

  UNION ALL

  -- Lacteos: proteina/aislado de leche -> tofu/tempeh/bebida soja
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 90::numeric, 1),
      ('Tempeh', 86::numeric, 2),
      ('Bebida de Soja', 85::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19
    AND (sf.source_name_norm LIKE '%proteina%' OR sf.source_name_norm LIKE '%aislado%')

  UNION ALL

  -- Lacteos: fallback general
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 90::numeric, 1),
      ('Tempeh', 86::numeric, 2),
      ('Yogur Soja', 85::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 19
    AND sf.source_name_norm NOT LIKE '%yogur%'
    AND sf.source_name_norm NOT LIKE '%kefir%'
    AND sf.source_name_norm NOT LIKE '%leche%'
    AND sf.source_name_norm NOT LIKE '%queso%'
    AND sf.source_name_norm NOT LIKE '%proteina%'
    AND sf.source_name_norm NOT LIKE '%aislado%'

  UNION ALL

  -- Derivados animales: mantequilla -> aceite de coco
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    95::numeric AS confidence_score,
    1 AS preference_rank
  FROM source_foods sf
  JOIN target_catalog tc
    ON tc.target_food_name = 'Aceite de coco'
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm LIKE '%mantequilla%'

  UNION ALL

  -- Derivados animales: miel -> stevia
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    95::numeric AS confidence_score,
    1 AS preference_rank
  FROM source_foods sf
  JOIN target_catalog tc
    ON tc.target_food_name = 'Stevia'
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm LIKE '%miel%'

  UNION ALL

  -- Derivados animales: fallback general
  SELECT
    sf.*,
    tc.target_food_id,
    tc.target_food_name,
    pref.confidence_score,
    pref.preference_rank
  FROM source_foods sf
  JOIN (
    VALUES
      ('Tofu', 90::numeric, 1),
      ('Tempeh', 86::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank)
    ON true
  JOIN target_catalog tc
    ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm NOT LIKE '%mantequilla%'
    AND sf.source_name_norm NOT LIKE '%miel%'
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
