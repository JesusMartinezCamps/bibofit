-- ============================================================
-- MIGRATION: Seed allergen-safe substitution mappings
-- Sensitivity: Gluten (id=1) — 37 source foods
--
-- Sub-groups:
--   cereal            → granos/harinas sin gluten
--   pan               → tortillas y panes sin gluten
--   pasta             → pasta de legumbre/arroz
--   pizza             → bases sin gluten
--   proteina_procesada → proteína limpia sin empanado
--   bebida            → bebida de avena → arroz
--   ultraprocesado    → snack sin gluten
--   general           → fallback
--
-- Idempotent: (source_food_id, target_food_id, context_key)
-- ============================================================

WITH sens AS (
  SELECT id AS sensitivity_id, name AS sensitivity_name
  FROM public.sensitivities
  WHERE name = 'Gluten'
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
        'Avena', 'Bulgur', 'Centeno', 'Cuscús', 'Espelta',
        'Harina de Avena', 'Harina de trigo', 'Kamut', 'Sémola'
      ) THEN 'cereal'
      WHEN f.name IN (
        'Pan de Barra', 'Pan de molde Integral', 'Pan de molde integral - Bimbo',
        'Pan Pita', 'Panecillos', 'Tortas WASA',
        'Tortilla de Trigo', 'Tortilla Trigo Integral - Hacendado',
        'Maxi Tortilla Trigo - Hacendado'
      ) THEN 'pan'
      WHEN f.name IN (
        'Macarrones', 'Pasta', 'Pasta integral', 'Fideos',
        'Gnocchis de queso', 'Tortellini Berenjena Hacendado'
      ) THEN 'pasta'
      WHEN f.name IN (
        'Masa congelada de Pizza - Hacendado', 'Masa fresca de Pizza - Hacendado'
      ) THEN 'pizza'
      WHEN f.name IN (
        'Delicias de Pollo', 'Hamburguesa Pollo - Mercadona',
        'Pollo empanado', 'Seitán'
      ) THEN 'proteina_procesada'
      WHEN f.name = 'Bebida de Avena' THEN 'bebida'
      WHEN f.name IN (
        'Galletas Digestive', 'Granola baja en azúcares',
        'Cereales Corn Flakes - Kellogg''s', 'Weetabix Crunch Chocolate',
        'Picatostes de ajo', 'Picatostes Tostados'
      ) THEN 'ultraprocesado'
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
    'Arroz', 'Arroz Integral', 'Quinoa', 'Mijo', 'Trigo sarraceno',
    'Harina de garbanzo',
    'Tortas de Arroz', 'Quinoa "al minuto" (125g)',
    'Macarrones de lentejas', 'Noodle de Arroz',
    'Bebida de Arroz',
    'Pechuga de Pollo', 'Pavo', 'Garbanzos Cocidos'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('cereal',             'Arroz',                      95::numeric, 1),
    ('cereal',             'Arroz Integral',              92::numeric, 2),
    ('cereal',             'Quinoa',                      90::numeric, 3),
    ('cereal',             'Mijo',                        85::numeric, 4),
    ('cereal',             'Trigo sarraceno',              85::numeric, 5),
    ('cereal',             'Harina de garbanzo',           80::numeric, 6),
    ('pan',                'Tortas de Arroz',              95::numeric, 1),
    ('pan',                'Quinoa "al minuto" (125g)',    75::numeric, 2),
    ('pasta',              'Macarrones de lentejas',       95::numeric, 1),
    ('pasta',              'Noodle de Arroz',              90::numeric, 2),
    ('pasta',              'Quinoa',                       82::numeric, 3),
    ('pizza',              'Tortas de Arroz',              88::numeric, 1),
    ('pizza',              'Quinoa',                       78::numeric, 2),
    ('proteina_procesada', 'Pechuga de Pollo',             92::numeric, 1),
    ('proteina_procesada', 'Pavo',                         88::numeric, 2),
    ('proteina_procesada', 'Garbanzos Cocidos',            80::numeric, 3),
    ('bebida',             'Bebida de Arroz',              97::numeric, 1),
    ('ultraprocesado',     'Tortas de Arroz',              75::numeric, 1),
    ('ultraprocesado',     'Quinoa "al minuto" (125g)',    70::numeric, 2),
    ('general',            'Arroz',                        80::numeric, 1),
    ('general',            'Quinoa',                       78::numeric, 2),
    ('general',            'Tortas de Arroz',              72::numeric, 3)
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
