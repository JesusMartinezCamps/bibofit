-- ============================================================
-- MIGRATION: Seed food_medical_conditions + substitution mappings
-- Conditions: Diabetes tipo 1 (id=1), Diabetes tipo 2 (id=2),
--             Enfermedad Celíaca (id=21)
--
-- CRITERIO avoid vs recommend:
--   avoid     → alimento que empeora o descontrola la condición.
--               Se muestra como conflicto en UI y activa sustituciones.
--   recommend → alimento terapéutico que ayuda a gestionar la condición.
--               Se muestra como señal positiva (sin sustitución).
--
-- DIABETES (tipos 1 y 2):
--   avoid:     Azúcares simples, carbohidratos refinados de alto IG,
--              frutas desecadas concentradas, procesados con azúcar añadida.
--              EXCLUIDOS deliberadamente: frutas frescas enteras (IG moderado
--              con fibra), lácteos sin azúcar añadida, cereales integrales.
--   recommend: Legumbres, cereales integrales, verduras, semillas ricas
--              en fibra soluble que ralentizan absorción de glucosa.
--
-- ENFERMEDAD CELÍACA:
--   avoid:     Idéntico a sensibilidad Gluten (mismos alimentos).
--              Se clona desde food_sensitivities para mantener consistencia.
--   recommend: Cereales sin gluten, pseudocereales, legumbres.
--
-- Idempotent: ON CONFLICT DO NOTHING / WHERE NOT EXISTS
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECCIÓN A: food_medical_conditions
-- ════════════════════════════════════════════════════════════

-- ── Diabetes tipos 1 y 2: avoid (alto IG / azúcares simples) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'avoid'
FROM public.food f
CROSS JOIN (
  SELECT id FROM public.medical_conditions
  WHERE name IN ('Diabetes tipo 1', 'Diabetes tipo 2')
) c
WHERE f.name IN (
  -- Azúcares y edulcorantes calóricos puros
  'Azúcar', 'Maltodextrina', 'Miel', 'Mermelada Genérica',
  -- Frutas desecadas: azúcar concentrada, IG muy alto
  'Dátiles', 'Higos secos', 'Pasas Sultanas', 'Orejones Albaricoque',
  -- Cereales procesados / ultraprocesados con azúcar
  'Cereales Corn Flakes - Kellogg''s', 'Weetabix Crunch Chocolate',
  'Galletas Digestive', 'Granola baja en azúcares',
  'Chocolate Fussion Hacendado',
  -- Panes blancos refinados (IG alto sin fibra)
  'Pan de Barra',
  -- Bebida vegetal con IG muy alto
  'Bebida de Arroz',
  -- Lácteo concentrado con azúcar natural muy elevada
  'Leche evaporada'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── Diabetes tipos 1 y 2: recommend (bajo IG, fibra, glucosa estable) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (
  SELECT id FROM public.medical_conditions
  WHERE name IN ('Diabetes tipo 1', 'Diabetes tipo 2')
) c
WHERE f.name IN (
  -- Cereales integrales / bajo IG
  'Arroz Integral', 'Avena', 'Quinoa', 'Trigo sarraceno', 'Mijo',
  -- Legumbres: fibra soluble + índice glucémico muy bajo
  'Garbanzos Cocidos', 'Garbanzos Crudos', 'Lentejas Cocidas',
  'Lentejas Crudas', 'Judías pintas', 'Alubia blanca seca',
  'Macarrones de lentejas',
  -- Verduras de hoja verde: fibra, bajo IG
  'Espinacas', 'Brócoli', 'Col rizada',
  -- Semillas: fibra soluble, omega-3
  'Semillas de chía', 'Lino',
  -- Especias: canela mejora sensibilidad a insulina
  'Canela'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── Enfermedad Celíaca: avoid (clonado desde sensibilidad Gluten) ─
-- Mismos alimentos que la sensibilidad Gluten (id=1), pero como
-- condición médica con daño intestinal activo — más estricto.
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT
  fs.food_id,
  (SELECT id FROM public.medical_conditions WHERE name = 'Enfermedad Celíaca'),
  'avoid'
FROM public.food_sensitivities fs
WHERE fs.sensitivity_id = (
  SELECT id FROM public.sensitivities WHERE name = 'Gluten'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── Enfermedad Celíaca: recommend (opciones sin gluten seguras) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (
  SELECT id FROM public.medical_conditions WHERE name = 'Enfermedad Celíaca'
) c
WHERE f.name IN (
  'Arroz', 'Arroz Integral', 'Quinoa', 'Mijo', 'Trigo sarraceno',
  'Macarrones de lentejas', 'Noodle de Arroz', 'Tortas de Arroz',
  'Harina de garbanzo',
  'Garbanzos Cocidos', 'Lentejas Cocidas'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SECCIÓN B: food_substitution_mappings
-- context_key: condition_avoid:{condition_id}
-- substitution_type: 'nutritional_equivalent' para condiciones médicas
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- BLOQUE 1: DIABETES TIPOS 1 Y 2 (ids variables, por nombre)
-- Sub-grupos:
--   azucar_simple  → edulcorantes sin calorías / especias
--   fruta_seca     → frutas frescas de bajo IG
--   cereal_proc    → cereales integrales / sin azúcar
--   pan_blanco     → pan integral / alternativas
--   bebida_alto_ig → bebida vegetal de menor IG
--   lacteo_conc    → lácteo menos concentrado
-- ────────────────────────────────────────────────────────────
WITH conditions AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions
  WHERE name IN ('Diabetes tipo 1', 'Diabetes tipo 2')
),
source_foods AS (
  SELECT
    c.condition_id,
    c.condition_name,
    f.id   AS source_food_id,
    f.name AS source_food_name,
    format('condition_avoid:%s', c.condition_id) AS context_key,
    CASE
      WHEN f.name IN ('Azúcar', 'Maltodextrina', 'Miel', 'Mermelada Genérica')
        THEN 'azucar_simple'
      WHEN f.name IN ('Dátiles', 'Higos secos', 'Pasas Sultanas', 'Orejones Albaricoque')
        THEN 'fruta_seca'
      WHEN f.name IN (
        'Cereales Corn Flakes - Kellogg''s', 'Weetabix Crunch Chocolate',
        'Galletas Digestive', 'Granola baja en azúcares', 'Chocolate Fussion Hacendado'
      ) THEN 'cereal_proc'
      WHEN f.name = 'Pan de Barra'    THEN 'pan_blanco'
      WHEN f.name = 'Bebida de Arroz' THEN 'bebida_alto_ig'
      WHEN f.name = 'Leche evaporada' THEN 'lacteo_conc'
      ELSE 'general'
    END AS sub_group
  FROM public.food_medical_conditions fmc
  JOIN public.food f  ON f.id = fmc.food_id
  JOIN conditions c   ON c.condition_id = fmc.condition_id
  WHERE fmc.relation_type = 'avoid'
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Stevia', 'Canela',
    'Arándanos', 'Fresa', 'Frambuesa',
    'Avena', 'Arroz Integral', 'Quinoa', 'Tortas de Arroz',
    'Pan de molde Integral',
    'Bebida de Soja',
    'Leche de vaca'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    -- azúcar simple → edulcorante sin IG
    ('azucar_simple', 'Stevia',          95::numeric, 1),
    ('azucar_simple', 'Canela',          80::numeric, 2),
    -- fruta seca → fruta fresca de bajo IG
    ('fruta_seca',    'Arándanos',       92::numeric, 1),
    ('fruta_seca',    'Fresa',           90::numeric, 2),
    ('fruta_seca',    'Frambuesa',       88::numeric, 3),
    -- cereales proc → integrales sin azúcar
    ('cereal_proc',   'Avena',           90::numeric, 1),
    ('cereal_proc',   'Arroz Integral',  87::numeric, 2),
    ('cereal_proc',   'Quinoa',          85::numeric, 3),
    ('cereal_proc',   'Tortas de Arroz', 75::numeric, 4),
    -- pan blanco → integral / sin gluten
    ('pan_blanco',    'Pan de molde Integral', 88::numeric, 1),
    ('pan_blanco',    'Tortas de Arroz',       82::numeric, 2),
    -- bebida alto IG → bebida vegetal menor IG
    ('bebida_alto_ig','Bebida de Soja',  92::numeric, 1),
    -- lácteo concentrado → lácteo menos concentrado
    ('lacteo_conc',   'Leche de vaca',   88::numeric, 1),
    -- fallback
    ('general',       'Avena',           78::numeric, 1),
    ('general',       'Quinoa',          75::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.condition_id, sf.condition_name,
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
    condition_id, condition_name,
    source_food_id, source_food_name,
    target_food_id, target_food_name,
    confidence_score, preference_rank, context_key,
    format('%s en conflicto con Condición médica: %s. Se reemplaza por %s.',
      source_food_name, condition_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm
  SET
    substitution_type = 'nutritional_equivalent',
    confidence_score  = c.confidence_score,
    reason            = c.reason,
    is_automatic      = true,
    metadata = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',           'medical_condition',
          'condition_id',   c.condition_id,
          'condition_name', c.condition_name,
          'relation_type',  'avoid'
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
  SELECT p.user_id FROM public.profiles p
  ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1
),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
  )
  SELECT
    c.source_food_id, c.target_food_id, 'nutritional_equivalent',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',           'medical_condition',
          'condition_id',   c.condition_id,
          'condition_name', c.condition_name,
          'relation_type',  'avoid'
        )
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
  'Diabetes tipo 1 + tipo 2'            AS condition,
  (SELECT COUNT(*) FROM candidate_rows)  AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)    AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)   AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 2: ENFERMEDAD CELÍACA
-- Clona los mappings existentes de sensibilidad Gluten (sensitivity:1)
-- cambiando context_key a condition_avoid:{celiaca_id}
-- ────────────────────────────────────────────────────────────
WITH condition AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions
  WHERE name = 'Enfermedad Celíaca'
),
gluten_mappings AS (
  SELECT
    fsm.source_food_id,
    fsm.target_food_id,
    fsm.confidence_score,
    fsm.is_automatic
  FROM public.food_substitution_mappings fsm
  WHERE fsm.metadata ->> 'context_key' = (
    'sensitivity:' || (SELECT id FROM public.sensitivities WHERE name = 'Gluten')::text
  )
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
  SELECT
    gm.source_food_id,
    gm.target_food_id,
    'nutritional_equivalent',
    gm.confidence_score,
    format('%s en conflicto con Condición médica: %s. Se reemplaza por %s.',
      sf.name, c.condition_name, tf.name),
    gm.is_automatic,
    cr.user_id,
    jsonb_build_object(
      'context_key',       format('condition_avoid:%s', c.condition_id),
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',           'medical_condition',
          'condition_id',   c.condition_id,
          'condition_name', c.condition_name,
          'relation_type',  'avoid'
        )
      )
    )
  FROM gluten_mappings gm
  CROSS JOIN condition c
  CROSS JOIN creator cr
  JOIN public.food sf ON sf.id = gm.source_food_id
  JOIN public.food tf ON tf.id = gm.target_food_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm2
    WHERE fsm2.source_food_id = gm.source_food_id
      AND fsm2.target_food_id = gm.target_food_id
      AND COALESCE(NULLIF(fsm2.metadata ->> 'context_key', ''), 'general') =
          format('condition_avoid:%s', c.condition_id)
  )
  RETURNING id
)
SELECT
  'Enfermedad Celíaca (clonado de Gluten)' AS condition,
  (SELECT COUNT(*) FROM gluten_mappings)   AS source_mappings,
  (SELECT COUNT(*) FROM inserted_rows)     AS inserted_count;
