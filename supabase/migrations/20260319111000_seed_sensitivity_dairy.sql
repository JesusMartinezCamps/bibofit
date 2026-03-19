-- ============================================================
-- MIGRATION: Seed allergen-safe substitution mappings
-- Sensitivities: Leche (id=7), Lactosa (id=20), Caseína A1 (id=26)
--
-- Las tres comparten la misma lógica de sub-grupos y target catalog.
-- Cada una genera su propio context_key independiente.
--
-- Targets con otras sensibilidades (filtrados en runtime si aplica):
--   Bebida de Soja   → filtrada si usuario tiene Soja
--   Bebida de Avena  → filtrada si usuario tiene Gluten
--   Yogur Soja       → filtrada si usuario tiene Soja
--   Tofu             → filtrado si usuario tiene Soja
--
-- Sub-grupos:
--   leche_liquida  → bebidas vegetales
--   mantequilla    → grasas vegetales
--   yogur          → yogur vegetal
--   queso          → alternativas vegetales
--   proteina_lactea → proteínas vegetales
--   procesado      → proteína limpia sin lácteo
--   general        → fallback
--
-- Idempotent: (source_food_id, target_food_id, context_key)
-- ============================================================

WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name IN ('Leche', 'Lactosa', 'Caseína A1')
),
source_foods AS (
  SELECT
    s.sensitivity_id,
    s.sensitivity_name,
    f.id   AS source_food_id,
    f.name AS source_food_name,
    format('sensitivity:%s', s.sensitivity_id) AS context_key,
    CASE
      WHEN f.name IN (
        'Leche de vaca', 'Leche Entera', 'Leche Desnatada Sin Lactosa',
        'Leche Entera Sin Lactosa', 'Leche evaporada'
      ) THEN 'leche_liquida'
      WHEN f.name = 'Mantequilla' THEN 'mantequilla'
      WHEN f.name IN (
        'Yogur griego', 'Yogur natural', 'Yogur Proteico Hacendado', 'Kéfir'
      ) THEN 'yogur'
      WHEN f.name IN (
        'Quesitos Light', 'Queso ahumado viejo', 'Queso Curado', 'Queso fresco',
        'Queso Fresco Batido 0%', 'Queso Fresco Batido 0% - 120 g',
        'Queso Fresco Burgos 0%', 'Queso Havarti Light', 'Queso Rallado Grana Padano'
      ) THEN 'queso'
      WHEN f.name IN (
        'Aislado de Proteína de Leche', 'Leche en Polvo Desgrasada',
        'Proteína Hidrolizada de Leche'
      ) THEN 'proteina_lactea'
      WHEN f.name IN (
        'Delicias de Pollo', 'Hamburguesa Pollo - Mercadona', 'Pollo empanado',
        'Gnocchis de queso', 'Tortellini Berenjena Hacendado',
        'Tortas de Maíz', 'Granola baja en azúcares'
      ) THEN 'procesado'
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
    -- leche_liquida
    'Bebida de Arroz', 'Bebida de Soja', 'Bebida de Avena',
    -- mantequilla
    'Aceite de coco', 'AOVE', 'Margarina',
    -- yogur
    'Yogur Soja',
    -- queso
    'Semillas de chía', 'Lino', 'Aguacate',
    -- proteina_lactea + procesado
    'Garbanzos Cocidos', 'Pechuga de Pollo', 'Pavo'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    -- leche líquida → bebidas vegetales (Soja/Avena filtradas por runtime si aplica)
    ('leche_liquida', 'Bebida de Arroz',  97::numeric, 1),
    ('leche_liquida', 'Bebida de Soja',   90::numeric, 2),
    ('leche_liquida', 'Bebida de Avena',  85::numeric, 3),
    -- mantequilla → grasas vegetales
    ('mantequilla', 'Aceite de coco', 95::numeric, 1),
    ('mantequilla', 'AOVE',           90::numeric, 2),
    ('mantequilla', 'Margarina',      82::numeric, 3),
    -- yogur → yogur vegetal (filtrado si Soja)
    ('yogur', 'Yogur Soja', 93::numeric, 1),
    -- queso → alternativas vegetales (confianza baja por naturaleza diferente)
    ('queso', 'Semillas de chía', 70::numeric, 1),
    ('queso', 'Lino',             68::numeric, 2),
    ('queso', 'Aguacate',         65::numeric, 3),
    -- proteína láctea → proteínas vegetales
    ('proteina_lactea', 'Lino',              78::numeric, 1),
    ('proteina_lactea', 'Semillas de chía',  75::numeric, 2),
    ('proteina_lactea', 'Garbanzos Cocidos', 70::numeric, 3),
    -- procesados con lácteo → proteína limpia
    ('procesado', 'Pechuga de Pollo',  88::numeric, 1),
    ('procesado', 'Pavo',              83::numeric, 2),
    ('procesado', 'Garbanzos Cocidos', 75::numeric, 3),
    -- fallback general
    ('general', 'Bebida de Arroz',  70::numeric, 1),
    ('general', 'Semillas de chía', 65::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT
    sf.sensitivity_id,
    sf.sensitivity_name,
    sf.source_food_id,
    sf.source_food_name,
    sf.context_key,
    tc.target_food_id,
    tc.target_food_name,
    sgp.confidence_score,
    sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    sensitivity_id,
    sensitivity_name,
    source_food_id,
    source_food_name,
    target_food_id,
    target_food_name,
    confidence_score,
    preference_rank,
    context_key,
    format(
      '%s en conflicto con Intolerancia/Alergia: %s. Se reemplaza por %s.',
      source_food_name,
      sensitivity_name,
      target_food_name
    ) AS reason
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
    metadata          = jsonb_build_object(
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',             'sensitivity',
          'sensitivity_id',   c.sensitivity_id,
          'sensitivity_name', c.sensitivity_name
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
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata
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
      'context_key',      c.context_key,
      'conflict_contexts', jsonb_build_array(
        jsonb_build_object(
          'type',             'sensitivity',
          'sensitivity_id',   c.sensitivity_id,
          'sensitivity_name', c.sensitivity_name
        )
      )
    )
  FROM candidate_rows c
  JOIN creator cr ON true
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
  (SELECT COUNT(*) FROM updated_rows)   AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)  AS inserted_count;
