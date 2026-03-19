-- ============================================================
-- MIGRATION: Seed allergen-safe substitution mappings
-- Sensitivities: Soja (id=6), Pescado (id=4),
--                Frutos de cáscara (id=8), Huevos (id=3)
--
-- Cada sensibilidad es un bloque WITH...INSERT independiente.
-- Targets con otras sensibilidades son válidos — filtrados en runtime.
-- Idempotent: (source_food_id, target_food_id, context_key)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- BLOQUE 1: SOJA (id=6) — 9 fuentes
-- Sub-grupos:
--   proteina_soja  → legumbres sin soja
--   bebida_soja    → bebida de arroz
--   yogur_soja     → yogur no-soja (filtrado si Leche en runtime)
--   procesado_soja → alternativas sin soja
--   condimento_soja → caldos/aceites
--   general        → fallback legumbre
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Soja'
),
source_foods AS (
  SELECT
    s.sensitivity_id,
    s.sensitivity_name,
    f.id   AS source_food_id,
    f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN ('Tofu', 'Tempeh', 'Soja texturizada', 'Edamame')
        THEN 'proteina_soja'
      WHEN f.name = 'Bebida de Soja'    THEN 'bebida_soja'
      WHEN f.name = 'Yogur Soja'        THEN 'yogur_soja'
      WHEN f.name IN ('Tortas de Maíz', 'Granola baja en azúcares')
        THEN 'procesado_soja'
      WHEN f.name = 'Salsa soja'        THEN 'condimento_soja'
      ELSE 'general'
    END AS sub_group
  FROM public.food_sensitivities fs
  JOIN public.food f ON f.id = fs.food_id
  JOIN sens s        ON s.sensitivity_id = fs.sensitivity_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Garbanzos Cocidos', 'Lentejas Cocidas', 'Garbanzos Crudos',
    'Harina de garbanzo', 'Lentejas Crudas',
    'Bebida de Arroz',
    'Yogur griego',
    'Tortas de Arroz',
    'Caldo de verduras', 'AOVE'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('proteina_soja',   'Garbanzos Cocidos',  92::numeric, 1),
    ('proteina_soja',   'Lentejas Cocidas',    90::numeric, 2),
    ('proteina_soja',   'Garbanzos Crudos',    85::numeric, 3),
    ('proteina_soja',   'Harina de garbanzo',  80::numeric, 4),
    ('proteina_soja',   'Lentejas Crudas',     78::numeric, 5),
    ('bebida_soja',     'Bebida de Arroz',     97::numeric, 1),
    -- Yogur griego filtrado en runtime si usuario tiene Leche
    ('yogur_soja',      'Yogur griego',        88::numeric, 1),
    ('procesado_soja',  'Tortas de Arroz',     93::numeric, 1),
    ('procesado_soja',  'Garbanzos Cocidos',   75::numeric, 2),
    ('condimento_soja', 'Caldo de verduras',   65::numeric, 1),
    ('condimento_soja', 'AOVE',                60::numeric, 2),
    ('general',         'Garbanzos Cocidos',   75::numeric, 1),
    ('general',         'Lentejas Cocidas',    72::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.sensitivity_id, sf.sensitivity_name,
    sf.source_food_id, sf.source_food_name,
    sf.context_key,
    tc.target_food_id, tc.target_food_name,
    sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    sensitivity_id, sensitivity_name,
    source_food_id, source_food_name,
    target_food_id, target_food_name,
    confidence_score, preference_rank, context_key,
    format('%s en conflicto con Intolerancia/Alergia: %s. Se reemplaza por %s.',
      source_food_name, sensitivity_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score  = c.confidence_score,
    reason            = c.reason,
    is_automatic      = true,
    metadata = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id
    AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  RETURNING fsm.id
),
creator AS (
  SELECT p.user_id FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
  )
  SELECT c.source_food_id, c.target_food_id, 'allergen_safe',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id
      AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  )
  RETURNING id
)
SELECT
  'Soja'                                    AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 2: PESCADO (id=4) — 9 fuentes
-- Sub-grupos:
--   pescado_fresco    → proteínas sin pescado
--   conserva_pescado  → proteínas alternativas
--   caldo_pescado     → caldos vegetales/carne
--   general           → fallback
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Pescado'
),
source_foods AS (
  SELECT
    s.sensitivity_id, s.sensitivity_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN ('Filete de Dorada', 'Merluza', 'Salmón', 'Caballa')
        THEN 'pescado_fresco'
      WHEN f.name IN (
        'Atún en Lata Natural (80g)', 'Caballa en lata',
        'Sardinas en lata', 'Salmón ahumado en lonchas'
      ) THEN 'conserva_pescado'
      WHEN f.name = 'Caldo de pescado' THEN 'caldo_pescado'
      ELSE 'general'
    END AS sub_group
  FROM public.food_sensitivities fs
  JOIN public.food f ON f.id = fs.food_id
  JOIN sens s        ON s.sensitivity_id = fs.sensitivity_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Pechuga de Pollo', 'Pavo',
    'Garbanzos Cocidos', 'Lentejas Cocidas',
    'Caldo de verduras', 'Caldo de pollo'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('pescado_fresco',   'Pechuga de Pollo',  85::numeric, 1),
    ('pescado_fresco',   'Pavo',              82::numeric, 2),
    ('pescado_fresco',   'Garbanzos Cocidos', 80::numeric, 3),
    ('pescado_fresco',   'Lentejas Cocidas',  78::numeric, 4),
    ('conserva_pescado', 'Garbanzos Cocidos', 83::numeric, 1),
    ('conserva_pescado', 'Lentejas Cocidas',  80::numeric, 2),
    ('conserva_pescado', 'Pechuga de Pollo',  75::numeric, 3),
    ('caldo_pescado',    'Caldo de verduras', 93::numeric, 1),
    ('caldo_pescado',    'Caldo de pollo',    88::numeric, 2),
    ('general',          'Garbanzos Cocidos', 78::numeric, 1),
    ('general',          'Pechuga de Pollo',  75::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.sensitivity_id, sf.sensitivity_name,
    sf.source_food_id, sf.source_food_name,
    sf.context_key,
    tc.target_food_id, tc.target_food_name,
    sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    sensitivity_id, sensitivity_name,
    source_food_id, source_food_name,
    target_food_id, target_food_name,
    confidence_score, preference_rank, context_key,
    format('%s en conflicto con Intolerancia/Alergia: %s. Se reemplaza por %s.',
      source_food_name, sensitivity_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score  = c.confidence_score,
    reason            = c.reason,
    is_automatic      = true,
    metadata = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id
    AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  RETURNING fsm.id
),
creator AS (
  SELECT p.user_id FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
  )
  SELECT c.source_food_id, c.target_food_id, 'allergen_safe',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id
      AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  )
  RETURNING id
)
SELECT
  'Pescado'                                 AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 3: FRUTOS DE CÁSCARA (id=8) — 8 fuentes
-- Sub-grupos:
--   fruto_seco    → semillas sin frutos secos
--   bebida_fruto  → bebida de arroz
--   procesado_fruto → snack sin frutos secos
--   general       → fallback semillas
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Frutos de cáscara'
),
source_foods AS (
  SELECT
    s.sensitivity_id, s.sensitivity_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN ('Almendra', 'Anacardo', 'Avellana', 'Avellanas', 'Nueces', 'Pistacho')
        THEN 'fruto_seco'
      WHEN f.name = 'Bebida de Avellana'          THEN 'bebida_fruto'
      WHEN f.name = 'Granola baja en azúcares'    THEN 'procesado_fruto'
      ELSE 'general'
    END AS sub_group
  FROM public.food_sensitivities fs
  JOIN public.food f ON f.id = fs.food_id
  JOIN sens s        ON s.sensitivity_id = fs.sensitivity_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Semillas de chía', 'Lino', 'Pipas de girasol', 'Pipas de calabaza',
    'Bebida de Arroz',
    'Tortas de Arroz', 'Quinoa "al minuto" (125g)'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('fruto_seco',      'Semillas de chía',           90::numeric, 1),
    ('fruto_seco',      'Lino',                        88::numeric, 2),
    ('fruto_seco',      'Pipas de girasol',            87::numeric, 3),
    ('fruto_seco',      'Pipas de calabaza',           85::numeric, 4),
    ('bebida_fruto',    'Bebida de Arroz',             97::numeric, 1),
    ('procesado_fruto', 'Tortas de Arroz',             72::numeric, 1),
    ('procesado_fruto', 'Quinoa "al minuto" (125g)',   68::numeric, 2),
    ('general',         'Semillas de chía',            82::numeric, 1),
    ('general',         'Lino',                        80::numeric, 2),
    ('general',         'Pipas de girasol',            78::numeric, 3)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.sensitivity_id, sf.sensitivity_name,
    sf.source_food_id, sf.source_food_name,
    sf.context_key,
    tc.target_food_id, tc.target_food_name,
    sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    sensitivity_id, sensitivity_name,
    source_food_id, source_food_name,
    target_food_id, target_food_name,
    confidence_score, preference_rank, context_key,
    format('%s en conflicto con Intolerancia/Alergia: %s. Se reemplaza por %s.',
      source_food_name, sensitivity_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score  = c.confidence_score,
    reason            = c.reason,
    is_automatic      = true,
    metadata = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id
    AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  RETURNING fsm.id
),
creator AS (
  SELECT p.user_id FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
  )
  SELECT c.source_food_id, c.target_food_id, 'allergen_safe',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id
      AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  )
  RETURNING id
)
SELECT
  'Frutos de cáscara'                       AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 4: HUEVOS (id=3) — 6 fuentes
-- Sub-grupos:
--   huevo_real       → proteínas vegetales/semillas (aglutinantes)
--   procesado_huevo  → proteína limpia sin empanado
--   general          → fallback
-- Nota: Tofu filtrado en runtime si usuario tiene Soja
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Huevos'
),
source_foods AS (
  SELECT
    s.sensitivity_id, s.sensitivity_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN ('Clara de huevo', 'Huevo', 'Huevo L') THEN 'huevo_real'
      WHEN f.name IN (
        'Delicias de Pollo', 'Hamburguesa Pollo - Mercadona', 'Pollo empanado'
      ) THEN 'procesado_huevo'
      ELSE 'general'
    END AS sub_group
  FROM public.food_sensitivities fs
  JOIN public.food f ON f.id = fs.food_id
  JOIN sens s        ON s.sensitivity_id = fs.sensitivity_id
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Semillas de chía', 'Lino',
    'Tofu',
    'Garbanzos Cocidos',
    'Pechuga de Pollo', 'Pavo'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('huevo_real',      'Semillas de chía',  88::numeric, 1),
    ('huevo_real',      'Lino',               85::numeric, 2),
    -- Tofu filtrado en runtime si usuario tiene Soja
    ('huevo_real',      'Tofu',               82::numeric, 3),
    ('huevo_real',      'Garbanzos Cocidos',  75::numeric, 4),
    ('procesado_huevo', 'Pechuga de Pollo',   92::numeric, 1),
    ('procesado_huevo', 'Pavo',               87::numeric, 2),
    ('procesado_huevo', 'Garbanzos Cocidos',  78::numeric, 3),
    ('general',         'Semillas de chía',   80::numeric, 1),
    ('general',         'Garbanzos Cocidos',  75::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.sensitivity_id, sf.sensitivity_name,
    sf.source_food_id, sf.source_food_name,
    sf.context_key,
    tc.target_food_id, tc.target_food_name,
    sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    sensitivity_id, sensitivity_name,
    source_food_id, source_food_name,
    target_food_id, target_food_name,
    confidence_score, preference_rank, context_key,
    format('%s en conflicto con Intolerancia/Alergia: %s. Se reemplaza por %s.',
      source_food_name, sensitivity_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'allergen_safe',
    confidence_score  = c.confidence_score,
    reason            = c.reason,
    is_automatic      = true,
    metadata = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id
    AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  RETURNING fsm.id
),
creator AS (
  SELECT p.user_id FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
  )
  SELECT c.source_food_id, c.target_food_id, 'allergen_safe',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object('type', 'sensitivity',
          'sensitivity_id', c.sensitivity_id, 'sensitivity_name', c.sensitivity_name)
      )
    )
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id
      AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata ->> 'context_key', ''), 'general') = c.context_key
  )
  RETURNING id
)
SELECT
  'Huevos'                                  AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;
