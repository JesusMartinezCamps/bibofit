-- ============================================================
-- MIGRATION: Seed DASH excluded substitution mappings
--
-- Diet: DASH (control de hipertensión arterial)
-- Excluded groups mapped:
--   - 20: Derivados animales (embutidos, mantequilla, miel…)
--   - 21: Ultraprocesados y snacks
--
-- Target selection criteria (basado en evidencia NHLBI DASH):
--   K⁺ elevado  → plátano, lentejas, garbanzos
--   Mg²⁺ alto   → almendra, nueces, avena
--   Ca²⁺         → yogur natural
--   Proteína vegetal sin sodio → tofu, lentejas, garbanzos
--   Grasas monoinsaturadas    → aguacate (vs mantequilla)
--
-- Pattern: delete existing DASH contexts + fresh insert.
-- ============================================================

WITH dash AS (
  SELECT id AS diet_type_id, name AS diet_type_name
  FROM public.diet_types
  WHERE name = 'DASH'
  LIMIT 1
),
excluded_contexts AS (
  SELECT
    d.diet_type_id,
    d.diet_type_name,
    r.food_group_id,
    fg.name AS food_group_name,
    format('diet_type:%s:excluded:%s', d.diet_type_id, r.food_group_id) AS context_key
  FROM dash d
  JOIN public.diet_type_food_group_rules r
    ON r.diet_type_id = d.diet_type_id
   AND r.rule_type = 'excluded'
  JOIN public.food_groups fg
    ON fg.id = r.food_group_id
  WHERE r.food_group_id IN (20, 21)
),
source_foods AS (
  SELECT
    ec.diet_type_id,
    ec.diet_type_name,
    ec.food_group_id,
    ec.food_group_name,
    ec.context_key,
    f.id   AS source_food_id,
    f.name AS source_food_name,
    translate(
      lower(f.name),
      'áàäâéèëêíìïîóòöôúùüûñç',
      'aaaaeeeeiiiioooouuuunc'
    ) AS source_name_norm
  FROM excluded_contexts ec
  JOIN public.food_to_food_groups ffg ON ffg.food_group_id = ec.food_group_id
  JOIN public.food f                  ON f.id = ffg.food_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Almendra',
    'Nueces',
    'Plátano',
    'Avena',
    'Yogur natural',
    'Lentejas Cocidas',
    'Garbanzos Cocidos',
    'Tofu',
    'Tempeh',
    'Aguacate'
  )
),
candidate_rows_raw AS (

  -- ── GRUPO 21: Ultraprocesados ─────────────────────────────

  -- Carnes procesadas / embutidos → legumbres + tofu (proteína vegetal, sin sodio)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Lentejas Cocidas', 95::numeric, 1),
    ('Garbanzos Cocidos', 93::numeric, 2),
    ('Tofu',             90::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND (
      sf.source_name_norm LIKE '%salchicha%'
      OR sf.source_name_norm LIKE '%frankfurt%'
      OR sf.source_name_norm LIKE '%chopped%'
      OR sf.source_name_norm LIKE '%jamon%'
      OR sf.source_name_norm LIKE '%mortadela%'
      OR sf.source_name_norm LIKE '%spam%'
    )

  UNION ALL

  -- Snacks salados / chips → frutos secos + avena (Mg²⁺, K⁺, sin sodio añadido)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Almendra', 94::numeric, 1),
    ('Nueces',   92::numeric, 2),
    ('Avena',    89::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND (
      sf.source_name_norm LIKE '%chips%'
      OR sf.source_name_norm LIKE '%ganchito%'
      OR sf.source_name_norm LIKE '%palomita%'
      OR sf.source_name_norm LIKE '%patata%frit%'
    )

  UNION ALL

  -- Galletas / crackers / barritas → avena + frutos secos + plátano (fibra soluble, K⁺)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Avena',    95::numeric, 1),
    ('Almendra', 92::numeric, 2),
    ('Plátano',  89::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND (
      sf.source_name_norm LIKE '%galleta%'
      OR sf.source_name_norm LIKE '%cracker%'
      OR sf.source_name_norm LIKE '%barrita%'
      OR sf.source_name_norm LIKE '%tostada%'
    )

  UNION ALL

  -- Chocolate procesado → frutos secos (Mg²⁺ natural, sin azúcar añadida)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Almendra', 95::numeric, 1),
    ('Nueces',   93::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND sf.source_name_norm LIKE '%chocolate%'

  UNION ALL

  -- Fallback ultraprocesados → frutos secos + plátano + yogur (perfil DASH completo)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Almendra',      90::numeric, 1),
    ('Nueces',        88::numeric, 2),
    ('Plátano',       86::numeric, 3),
    ('Yogur natural', 84::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 21
    AND sf.source_name_norm NOT LIKE '%salchicha%'
    AND sf.source_name_norm NOT LIKE '%frankfurt%'
    AND sf.source_name_norm NOT LIKE '%chopped%'
    AND sf.source_name_norm NOT LIKE '%jamon%'
    AND sf.source_name_norm NOT LIKE '%mortadela%'
    AND sf.source_name_norm NOT LIKE '%spam%'
    AND sf.source_name_norm NOT LIKE '%chips%'
    AND sf.source_name_norm NOT LIKE '%ganchito%'
    AND sf.source_name_norm NOT LIKE '%palomita%'
    AND sf.source_name_norm NOT LIKE '%patata%frit%'
    AND sf.source_name_norm NOT LIKE '%galleta%'
    AND sf.source_name_norm NOT LIKE '%cracker%'
    AND sf.source_name_norm NOT LIKE '%barrita%'
    AND sf.source_name_norm NOT LIKE '%tostada%'
    AND sf.source_name_norm NOT LIKE '%chocolate%'

  UNION ALL

  -- ── GRUPO 20: Derivados animales ──────────────────────────

  -- Mantequilla → aguacate + almendra (grasas monoinsaturadas, K⁺, sin Na)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Aguacate', 95::numeric, 1),
    ('Almendra', 88::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm LIKE '%mantequilla%'

  UNION ALL

  -- Miel → plátano + avena (dulzor natural, K⁺, fibra soluble)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Plátano', 93::numeric, 1),
    ('Avena',   90::numeric, 2)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm LIKE '%miel%'

  UNION ALL

  -- Embutidos / fiambres derivados → legumbres + tofu + tempeh (sin sodio añadido)
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Lentejas Cocidas',  95::numeric, 1),
    ('Garbanzos Cocidos', 93::numeric, 2),
    ('Tofu',              90::numeric, 3),
    ('Tempeh',            87::numeric, 4)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 20
    AND (
      sf.source_name_norm LIKE '%embutido%'
      OR sf.source_name_norm LIKE '%fiambre%'
      OR sf.source_name_norm LIKE '%chorizo%'
      OR sf.source_name_norm LIKE '%salchicha%'
      OR sf.source_name_norm LIKE '%jamon%'
      OR sf.source_name_norm LIKE '%panceta%'
      OR sf.source_name_norm LIKE '%morcilla%'
      OR sf.source_name_norm LIKE '%cecina%'
      OR sf.source_name_norm LIKE '%butifarra%'
      OR sf.source_name_norm LIKE '%lomo embuchado%'
    )

  UNION ALL

  -- Fallback derivados animales → tofu + lentejas + garbanzos
  SELECT sf.*, tc.target_food_id, tc.target_food_name, pref.confidence_score, pref.preference_rank
  FROM source_foods sf
  JOIN (VALUES
    ('Tofu',              90::numeric, 1),
    ('Lentejas Cocidas',  88::numeric, 2),
    ('Garbanzos Cocidos', 86::numeric, 3)
  ) AS pref(target_food_name, confidence_score, preference_rank) ON true
  JOIN target_catalog tc ON tc.target_food_name = pref.target_food_name
  WHERE sf.food_group_id = 20
    AND sf.source_name_norm NOT LIKE '%mantequilla%'
    AND sf.source_name_norm NOT LIKE '%miel%'
    AND sf.source_name_norm NOT LIKE '%embutido%'
    AND sf.source_name_norm NOT LIKE '%fiambre%'
    AND sf.source_name_norm NOT LIKE '%chorizo%'
    AND sf.source_name_norm NOT LIKE '%salchicha%'
    AND sf.source_name_norm NOT LIKE '%jamon%'
    AND sf.source_name_norm NOT LIKE '%panceta%'
    AND sf.source_name_norm NOT LIKE '%morcilla%'
    AND sf.source_name_norm NOT LIKE '%cecina%'
    AND sf.source_name_norm NOT LIKE '%butifarra%'
    AND sf.source_name_norm NOT LIKE '%lomo embuchado%'

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
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',           'diet_type',
          'diet_type_id',   c.diet_type_id,
          'diet_type_name', c.diet_type_name,
          'food_group_id',  c.food_group_id,
          'food_group_name', c.food_group_name,
          'rule_type',      'excluded'
        )
      )
    )
  FROM candidate_rows c
  JOIN creator cr ON true
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM candidate_rows)  AS candidate_rows_count,
  (SELECT COUNT(*) FROM deleted_rows)    AS deleted_rows_count,
  (SELECT COUNT(*) FROM inserted_rows)   AS inserted_rows_count;
