-- ============================================================
-- MIGRATION: Enrich substitution variety for:
-- - Vegana Estricta
-- - Vegetariana Estricta
--
-- Goal:
-- Add more varied targets (legumes, nuts, whole grains, tofu/tempeh)
-- for excluded groups, without deleting existing mappings.
--
-- Notes:
-- - Only excluded contexts are touched.
-- - Existing rows for same (source,target,context_key) are updated.
-- - Missing rows are inserted.
-- ============================================================

WITH desired_targets AS (
  SELECT *
  FROM (
    VALUES
      -- ==============================
      -- Vegana Estricta (id=2)
      -- ==============================
      -- Carnes blancas (13)
      ('Vegana Estricta'::text, 13::bigint, 'Tofu'::text, 95::numeric, 1::int),
      ('Vegana Estricta', 13, 'Tempeh', 93, 2),
      ('Vegana Estricta', 13, 'Soja texturizada', 91, 3),
      ('Vegana Estricta', 13, 'Garbanzos Cocidos', 89, 4),
      ('Vegana Estricta', 13, 'Lentejas Cocidas', 88, 5),
      ('Vegana Estricta', 13, 'Avena', 86, 6),
      ('Vegana Estricta', 13, 'Arroz Integral', 85, 7),
      ('Vegana Estricta', 13, 'Almendra', 85, 8),

      -- Carnes rojas (14)
      ('Vegana Estricta', 14, 'Soja texturizada', 95, 1),
      ('Vegana Estricta', 14, 'Garbanzos Cocidos', 94, 2),
      ('Vegana Estricta', 14, 'Lentejas Cocidas', 93, 3),
      ('Vegana Estricta', 14, 'Tempeh', 92, 4),
      ('Vegana Estricta', 14, 'Tofu', 90, 5),
      ('Vegana Estricta', 14, 'Quinoa', 88, 6),
      ('Vegana Estricta', 14, 'Nueces', 86, 7),

      -- Pescados blancos (15)
      ('Vegana Estricta', 15, 'Tofu', 95, 1),
      ('Vegana Estricta', 15, 'Tempeh', 93, 2),
      ('Vegana Estricta', 15, 'Garbanzos Cocidos', 90, 3),
      ('Vegana Estricta', 15, 'Lentejas Cocidas', 89, 4),
      ('Vegana Estricta', 15, 'Quinoa', 87, 5),
      ('Vegana Estricta', 15, 'Trigo sarraceno', 86, 6),
      ('Vegana Estricta', 15, 'Nueces', 85, 7),

      -- Pescados azules (16)
      ('Vegana Estricta', 16, 'Tofu', 95, 1),
      ('Vegana Estricta', 16, 'Tempeh', 93, 2),
      ('Vegana Estricta', 16, 'Garbanzos Cocidos', 90, 3),
      ('Vegana Estricta', 16, 'Lentejas Cocidas', 89, 4),
      ('Vegana Estricta', 16, 'Quinoa', 87, 5),
      ('Vegana Estricta', 16, 'Trigo sarraceno', 86, 6),
      ('Vegana Estricta', 16, 'Nueces', 85, 7),

      -- Mariscos y moluscos (17)
      ('Vegana Estricta', 17, 'Tempeh', 95, 1),
      ('Vegana Estricta', 17, 'Tofu', 93, 2),
      ('Vegana Estricta', 17, 'Garbanzos Cocidos', 90, 3),
      ('Vegana Estricta', 17, 'Lentejas Cocidas', 89, 4),
      ('Vegana Estricta', 17, 'Quinoa', 87, 5),
      ('Vegana Estricta', 17, 'Nueces', 85, 6),

      -- Huevos (18)
      ('Vegana Estricta', 18, 'Harina de garbanzo', 96, 1),
      ('Vegana Estricta', 18, 'Tofu', 93, 2),
      ('Vegana Estricta', 18, 'Tempeh', 91, 3),
      ('Vegana Estricta', 18, 'Garbanzos Cocidos', 89, 4),

      -- Lacteos (19)
      ('Vegana Estricta', 19, 'Yogur Soja', 96, 1),
      ('Vegana Estricta', 19, 'Bebida de Soja', 94, 2),
      ('Vegana Estricta', 19, 'Bebida de Avena', 93, 3),
      ('Vegana Estricta', 19, 'Bebida de Arroz', 91, 4),
      ('Vegana Estricta', 19, 'Bebida de Avellana', 90, 5),
      ('Vegana Estricta', 19, 'Almendra', 88, 6),
      ('Vegana Estricta', 19, 'Nueces', 87, 7),
      ('Vegana Estricta', 19, 'Coco rallado', 86, 8),
      ('Vegana Estricta', 19, 'Tofu', 85, 9),
      ('Vegana Estricta', 19, 'Tempeh', 85, 10),

      -- Derivados animales (20)
      ('Vegana Estricta', 20, 'Aceite de coco', 95, 1),
      ('Vegana Estricta', 20, 'Stevia', 93, 2),
      ('Vegana Estricta', 20, 'Tofu', 90, 3),
      ('Vegana Estricta', 20, 'Tempeh', 89, 4),
      ('Vegana Estricta', 20, 'Almendra', 87, 5),
      ('Vegana Estricta', 20, 'Nueces', 86, 6),
      ('Vegana Estricta', 20, 'Aguacate', 85, 7),

      -- ==============================
      -- Vegetariana Estricta (id=4)
      -- ==============================
      -- Carnes blancas (13)
      ('Vegetariana Estricta'::text, 13::bigint, 'Tofu'::text, 95::numeric, 1::int),
      ('Vegetariana Estricta', 13, 'Tempeh', 93, 2),
      ('Vegetariana Estricta', 13, 'Soja texturizada', 91, 3),
      ('Vegetariana Estricta', 13, 'Garbanzos Cocidos', 89, 4),
      ('Vegetariana Estricta', 13, 'Lentejas Cocidas', 88, 5),
      ('Vegetariana Estricta', 13, 'Avena', 86, 6),
      ('Vegetariana Estricta', 13, 'Arroz Integral', 85, 7),
      ('Vegetariana Estricta', 13, 'Almendra', 85, 8),

      -- Carnes rojas (14)
      ('Vegetariana Estricta', 14, 'Soja texturizada', 95, 1),
      ('Vegetariana Estricta', 14, 'Garbanzos Cocidos', 94, 2),
      ('Vegetariana Estricta', 14, 'Lentejas Cocidas', 93, 3),
      ('Vegetariana Estricta', 14, 'Tempeh', 92, 4),
      ('Vegetariana Estricta', 14, 'Tofu', 90, 5),
      ('Vegetariana Estricta', 14, 'Quinoa', 88, 6),
      ('Vegetariana Estricta', 14, 'Nueces', 86, 7),

      -- Pescados blancos (15)
      ('Vegetariana Estricta', 15, 'Tofu', 95, 1),
      ('Vegetariana Estricta', 15, 'Tempeh', 93, 2),
      ('Vegetariana Estricta', 15, 'Garbanzos Cocidos', 90, 3),
      ('Vegetariana Estricta', 15, 'Lentejas Cocidas', 89, 4),
      ('Vegetariana Estricta', 15, 'Quinoa', 87, 5),
      ('Vegetariana Estricta', 15, 'Trigo sarraceno', 86, 6),
      ('Vegetariana Estricta', 15, 'Nueces', 85, 7),

      -- Pescados azules (16)
      ('Vegetariana Estricta', 16, 'Tofu', 95, 1),
      ('Vegetariana Estricta', 16, 'Tempeh', 93, 2),
      ('Vegetariana Estricta', 16, 'Garbanzos Cocidos', 90, 3),
      ('Vegetariana Estricta', 16, 'Lentejas Cocidas', 89, 4),
      ('Vegetariana Estricta', 16, 'Quinoa', 87, 5),
      ('Vegetariana Estricta', 16, 'Trigo sarraceno', 86, 6),
      ('Vegetariana Estricta', 16, 'Nueces', 85, 7),

      -- Mariscos y moluscos (17)
      ('Vegetariana Estricta', 17, 'Tempeh', 95, 1),
      ('Vegetariana Estricta', 17, 'Tofu', 93, 2),
      ('Vegetariana Estricta', 17, 'Garbanzos Cocidos', 90, 3),
      ('Vegetariana Estricta', 17, 'Lentejas Cocidas', 89, 4),
      ('Vegetariana Estricta', 17, 'Quinoa', 87, 5),
      ('Vegetariana Estricta', 17, 'Nueces', 85, 6)
  ) AS t(diet_type_name, food_group_id, target_food_name, confidence_score, preference_rank)
),
contexts AS (
  SELECT
    dt.id AS diet_type_id,
    dt.name AS diet_type_name,
    r.food_group_id,
    fg.name AS food_group_name,
    format('diet_type:%s:excluded:%s', dt.id, r.food_group_id) AS context_key
  FROM public.diet_types dt
  JOIN public.diet_type_food_group_rules r
    ON r.diet_type_id = dt.id
   AND r.rule_type = 'excluded'
  JOIN public.food_groups fg
    ON fg.id = r.food_group_id
  WHERE dt.name IN ('Vegana Estricta', 'Vegetariana Estricta')
),
source_foods AS (
  SELECT
    c.diet_type_id,
    c.diet_type_name,
    c.food_group_id,
    c.food_group_name,
    c.context_key,
    f.id AS source_food_id,
    f.name AS source_food_name
  FROM contexts c
  JOIN public.food_to_food_groups ffg
    ON ffg.food_group_id = c.food_group_id
  JOIN public.food f
    ON f.id = ffg.food_id
),
candidate_rows AS (
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
