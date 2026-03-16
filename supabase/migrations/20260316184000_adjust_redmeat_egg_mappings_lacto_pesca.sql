-- ============================================================
-- MIGRATION: Adjust substitution variety for:
-- - Pescetariana (excluded: carnes rojas)
-- - Lactovegetariana (excluded: carnes rojas, huevos)
--
-- Requested behavior:
-- - Red meats -> legumes (garbanzos/lentejas).
-- - Eggs (lactovegetariana) -> harina de garbanzo (always).
--
-- This migration:
-- 1) Removes non-desired targets in affected contexts.
-- 2) Upserts desired targets for every source food in those groups.
-- ============================================================

WITH desired_targets AS (
  SELECT *
  FROM (
    VALUES
      -- Lactovegetariana, Carnes rojas
      ('Lactovegetariana'::text, 14::bigint, 'Garbanzos Cocidos'::text, 95::numeric, 1::int),
      ('Lactovegetariana'::text, 14::bigint, 'Lentejas Cocidas'::text, 94::numeric, 2::int),
      ('Lactovegetariana'::text, 14::bigint, 'Garbanzos Crudos'::text, 90::numeric, 3::int),
      ('Lactovegetariana'::text, 14::bigint, 'Lentejas Crudas'::text, 89::numeric, 4::int),

      -- Pescetariana, Carnes rojas
      ('Pescetariana'::text, 14::bigint, 'Garbanzos Cocidos'::text, 95::numeric, 1::int),
      ('Pescetariana'::text, 14::bigint, 'Lentejas Cocidas'::text, 94::numeric, 2::int),
      ('Pescetariana'::text, 14::bigint, 'Garbanzos Crudos'::text, 90::numeric, 3::int),
      ('Pescetariana'::text, 14::bigint, 'Lentejas Crudas'::text, 89::numeric, 4::int),

      -- Lactovegetariana, Huevos (siempre)
      ('Lactovegetariana'::text, 18::bigint, 'Harina de garbanzo'::text, 96::numeric, 1::int)
  ) AS t(diet_type_name, food_group_id, target_food_name, confidence_score, preference_rank)
),
affected_contexts AS (
  SELECT
    dt.id AS diet_type_id,
    dt.name AS diet_type_name,
    r.food_group_id,
    fg.name AS food_group_name,
    format('diet_type:%s:excluded:%s', dt.id, r.food_group_id) AS context_key
  FROM public.diet_types dt
  JOIN public.diet_type_food_group_rules r
    ON r.diet_type_id = dt.id
  JOIN public.food_groups fg
    ON fg.id = r.food_group_id
  WHERE r.rule_type = 'excluded'
    AND (
      (dt.name = 'Lactovegetariana' AND r.food_group_id IN (14, 18))
      OR (dt.name = 'Pescetariana' AND r.food_group_id = 14)
    )
),
source_foods AS (
  SELECT
    ac.diet_type_id,
    ac.diet_type_name,
    ac.food_group_id,
    ac.food_group_name,
    ac.context_key,
    f.id AS source_food_id,
    f.name AS source_food_name
  FROM affected_contexts ac
  JOIN public.food_to_food_groups ffg
    ON ffg.food_group_id = ac.food_group_id
  JOIN public.food f
    ON f.id = ffg.food_id
),
desired_candidates AS (
  SELECT
    sf.diet_type_id,
    sf.diet_type_name,
    sf.food_group_id,
    sf.food_group_name,
    sf.context_key,
    sf.source_food_id,
    sf.source_food_name,
    tf.id AS target_food_id,
    tf.name AS target_food_name,
    dt.confidence_score,
    dt.preference_rank,
    format(
      '%s en conflicto con Dieta (No compatible): %s · %s. Se reemplaza por %s.',
      sf.source_food_name,
      sf.diet_type_name,
      sf.food_group_name,
      tf.name
    ) AS reason
  FROM source_foods sf
  JOIN desired_targets dt
    ON dt.diet_type_name = sf.diet_type_name
   AND dt.food_group_id = sf.food_group_id
  JOIN public.food tf
    ON tf.name = dt.target_food_name
),
desired_pairs AS (
  SELECT DISTINCT source_food_id, target_food_id, context_key
  FROM desired_candidates
),
deleted_rows AS (
  DELETE FROM public.food_substitution_mappings fsm
  USING affected_contexts ac
  WHERE COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = ac.context_key
    AND NOT EXISTS (
      SELECT 1
      FROM desired_pairs dp
      WHERE dp.source_food_id = fsm.source_food_id
        AND dp.target_food_id = fsm.target_food_id
        AND dp.context_key = ac.context_key
    )
  RETURNING fsm.id
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score = dc.confidence_score,
    reason = dc.reason,
    is_automatic = true,
    metadata = jsonb_build_object(
      'context_key', dc.context_key,
      'conflict_contexts',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'diet_type',
          'diet_type_id', dc.diet_type_id,
          'diet_type_name', dc.diet_type_name,
          'food_group_id', dc.food_group_id,
          'food_group_name', dc.food_group_name,
          'rule_type', 'excluded'
        )
      )
    )
  FROM desired_candidates dc
  WHERE fsm.source_food_id = dc.source_food_id
    AND fsm.target_food_id = dc.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = dc.context_key
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
    dc.source_food_id,
    dc.target_food_id,
    'allergen_safe',
    dc.confidence_score,
    dc.reason,
    true,
    cr.user_id,
    jsonb_build_object(
      'context_key', dc.context_key,
      'conflict_contexts',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'diet_type',
          'diet_type_id', dc.diet_type_id,
          'diet_type_name', dc.diet_type_name,
          'food_group_id', dc.food_group_id,
          'food_group_name', dc.food_group_name,
          'rule_type', 'excluded'
        )
      )
    )
  FROM desired_candidates dc
  JOIN creator cr
    ON true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = dc.source_food_id
      AND fsm.target_food_id = dc.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = dc.context_key
  )
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM desired_candidates) AS desired_rows_count,
  (SELECT COUNT(*) FROM deleted_rows) AS deleted_rows_count,
  (SELECT COUNT(*) FROM updated_rows) AS updated_rows_count,
  (SELECT COUNT(*) FROM inserted_rows) AS inserted_rows_count;
