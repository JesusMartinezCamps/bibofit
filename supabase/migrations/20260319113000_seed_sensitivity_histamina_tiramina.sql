-- ============================================================
-- MIGRATION: Seed allergen-safe substitution mappings
-- Sensitivities: Histamina (id=24), Tiramina (id=25)
--
-- Lógica: sustituir alimentos fermentados/curados/enlatados/madurados
-- por equivalentes frescos del mismo grupo proteico.
--
-- Targets con otras sensibilidades (filtrados en runtime):
--   Queso fresco / Queso Fresco Batido 0% → Leche/Lactosa
--   Tofu                                  → Soja
--
-- Sub-grupos Histamina:
--   pescado_hist      → pescados frescos sin histamina
--   queso_hist        → queso fresco (filtrado si Leche en runtime)
--   yogur_hist        → alternativa fresca (filtrada si Leche)
--   carne_curada_hist → proteína fresca
--   fermentado_hist   → legumbres
--   condimento_hist   → caldo vegetal
--   general           → fallback
--
-- Sub-grupos Tiramina:
--   queso_tir      → queso fresco (filtrado si Leche en runtime)
--   yogur_tir      → alternativa fresca (filtrada si Leche)
--   carne_tir      → proteína fresca
--   fermentado_tir → legumbres
--   condimento_tir → caldo vegetal
--   general        → fallback
--
-- Idempotent: (source_food_id, target_food_id, context_key)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- BLOQUE 1: HISTAMINA (id=24) — 19 fuentes
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Histamina'
),
source_foods AS (
  SELECT
    s.sensitivity_id, s.sensitivity_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN (
        'Atún en Lata Natural (80g)', 'Caballa', 'Caballa en lata',
        'Merluza', 'Salmón', 'Salmón ahumado en lonchas',
        'Sardinas en lata', 'Caldo de pescado'
      ) THEN 'pescado_hist'
      WHEN f.name IN (
        'Quesitos Light', 'Queso Curado', 'Queso Havarti Light',
        'Queso Rallado Grana Padano', 'Gnocchis de queso'
      ) THEN 'queso_hist'
      WHEN f.name IN ('Kéfir', 'Yogur griego', 'Yogur Proteico Hacendado')
        THEN 'yogur_hist'
      WHEN f.name = 'Jamón serrano' THEN 'carne_curada_hist'
      WHEN f.name = 'Tempeh'        THEN 'fermentado_hist'
      WHEN f.name = 'Salsa soja'    THEN 'condimento_hist'
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
    -- pescados frescos sin histamina
    'Abadejo', 'Bacalao', 'Lenguado', 'Rape',
    -- proteína fresca
    'Pechuga de Pollo', 'Pavo', 'Jamón cocido (85%)',
    -- queso fresco (filtrado si Leche en runtime)
    'Queso fresco', 'Queso Fresco Batido 0%',
    -- legumbres
    'Garbanzos Cocidos',
    -- tofu (filtrado si Soja en runtime)
    'Tofu',
    -- caldo
    'Caldo de verduras',
    -- semillas
    'Semillas de chía'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('pescado_hist',      'Abadejo',               92::numeric, 1),
    ('pescado_hist',      'Bacalao',               90::numeric, 2),
    ('pescado_hist',      'Lenguado',              88::numeric, 3),
    ('pescado_hist',      'Rape',                  85::numeric, 4),
    ('pescado_hist',      'Pechuga de Pollo',      78::numeric, 5),
    -- Queso fresco filtrado en runtime si usuario tiene Leche
    ('queso_hist',        'Queso fresco',          85::numeric, 1),
    ('queso_hist',        'Semillas de chía',      72::numeric, 2),
    -- Queso Fresco Batido filtrado en runtime si Leche/Lactosa
    ('yogur_hist',        'Queso Fresco Batido 0%', 82::numeric, 1),
    ('carne_curada_hist', 'Pechuga de Pollo',      88::numeric, 1),
    ('carne_curada_hist', 'Pavo',                  85::numeric, 2),
    ('carne_curada_hist', 'Jamón cocido (85%)',    83::numeric, 3),
    -- Tofu filtrado en runtime si Soja
    ('fermentado_hist',   'Garbanzos Cocidos',     88::numeric, 1),
    ('fermentado_hist',   'Tofu',                  82::numeric, 2),
    ('condimento_hist',   'Caldo de verduras',     68::numeric, 1),
    ('general',           'Abadejo',               80::numeric, 1),
    ('general',           'Pechuga de Pollo',      78::numeric, 2),
    ('general',           'Garbanzos Cocidos',     75::numeric, 3)
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
  'Histamina'                               AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 2: TIRAMINA (id=25) — 12 fuentes
-- ────────────────────────────────────────────────────────────
WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Tiramina'
),
source_foods AS (
  SELECT
    s.sensitivity_id, s.sensitivity_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN (
        'Quesitos Light', 'Queso Curado', 'Queso Havarti Light',
        'Queso Rallado Grana Padano', 'Gnocchis de queso'
      ) THEN 'queso_tir'
      WHEN f.name IN ('Kéfir', 'Yogur griego', 'Yogur Proteico Hacendado')
        THEN 'yogur_tir'
      WHEN f.name IN ('Jamón serrano', 'Hígado de ternera') THEN 'carne_tir'
      WHEN f.name = 'Tempeh'     THEN 'fermentado_tir'
      WHEN f.name = 'Salsa soja' THEN 'condimento_tir'
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
    'Queso fresco', 'Queso Fresco Batido 0%',
    'Pechuga de Pollo', 'Pavo', 'Jamón cocido (85%)',
    'Garbanzos Cocidos', 'Tofu',
    'Caldo de verduras',
    'Semillas de chía'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    -- Queso fresco filtrado en runtime si Leche
    ('queso_tir',      'Queso fresco',          85::numeric, 1),
    ('queso_tir',      'Semillas de chía',       72::numeric, 2),
    -- Queso Fresco Batido filtrado en runtime si Leche/Lactosa
    ('yogur_tir',      'Queso Fresco Batido 0%', 82::numeric, 1),
    ('carne_tir',      'Pechuga de Pollo',        88::numeric, 1),
    ('carne_tir',      'Pavo',                    85::numeric, 2),
    ('carne_tir',      'Jamón cocido (85%)',      83::numeric, 3),
    -- Tofu filtrado en runtime si Soja
    ('fermentado_tir', 'Garbanzos Cocidos',       88::numeric, 1),
    ('fermentado_tir', 'Tofu',                    82::numeric, 2),
    ('condimento_tir', 'Caldo de verduras',       68::numeric, 1),
    ('general',        'Pechuga de Pollo',         78::numeric, 1),
    ('general',        'Garbanzos Cocidos',        75::numeric, 2)
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
  'Tiramina'                                AS sensitivity,
  (SELECT COUNT(*) FROM candidate_rows)     AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)       AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)      AS inserted_count;
