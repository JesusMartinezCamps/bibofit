-- ============================================================
-- MIGRATION: Seed food_medical_conditions + substitution mappings
-- Conditions: Hipertensión (id=3), Hipercolesterolemia (id=20),
--             Anemia ferropénica (id=23), Osteoporosis (id=22),
--             Reflujo gastroesofágico / ERGE (id=8)
--
-- CRITERIO avoid vs recommend:
--
-- HIPERTENSIÓN:
--   avoid:     Alimentos con sodio elevado (>500mg/100g aprox): embutidos,
--              conservas, salsas industriales, quesos curados.
--              NO se incluye la sal como ingrediente puro (no está en catálogo).
--   recommend: Potasio (aguacate, plátano, legumbres), omega-3 (pescado azul),
--              AOVE, magnesio (semillas, verduras verdes).
--
-- HIPERCOLESTEROLEMIA:
--   avoid:     Grasas saturadas y trans: mantequilla, aceite de coco,
--              margarina, quesos grasos, leche entera, coco rallado,
--              carne roja, galletas con grasa saturada.
--              NO se incluyen huevos (evidencia actual no justifica evitarlos).
--   recommend: Grasas insaturadas (AOVE, aguacate, frutos secos),
--              omega-3 (pescado azul), fibra soluble (legumbres, avena).
--
-- ANEMIA FERROPÉNICA:
--   avoid:     Inhibidores de la absorción de hierro no hemo:
--              polifenoles del cacao/chocolate. NOTA: son "evitar junto con
--              alimentos ricos en hierro", no absolutos — confianza reducida.
--   recommend: Hierro hemo (hígados, carnes), hierro no hemo (legumbres,
--              semillas, verduras de hoja) + vitamina C (brócoli, pimientos).
--
-- OSTEOPOROSIS:
--   Solo recommend (calcio, vitamina K). Sin avoid relevante en catálogo.
--
-- ERGE / REFLUJO:
--   avoid:     Alimentos ácidos (tomate, salsas de tomate), estimulantes
--              que relajan el esfínter esofágico inferior (chocolate, cacao,
--              grasas saturadas), y alimentos trigger comunes (ajo, cebolla).
--   recommend: Alimentos alcalinos y de fácil digestión (arroz, avena,
--              boniato, verduras cocinadas).
--
-- Idempotent: ON CONFLICT DO NOTHING / WHERE NOT EXISTS
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECCIÓN A: food_medical_conditions
-- ════════════════════════════════════════════════════════════

-- ── HIPERTENSIÓN: avoid (alto sodio) ─────────────────────────
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'avoid'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Hipertensión') c
WHERE f.name IN (
  -- Embutidos curados: muy alto en sodio
  'Jamón serrano',
  -- Condimentos con sodio extremo
  'Salsa soja',
  -- Salsas industriales (sodio + conservantes)
  'Salsa de Tomate "Solís"', 'Salsa Tomate Albahaca',
  -- Conservas de pescado en sal
  'Sardinas en lata', 'Atún en Lata Natural (80g)', 'Caballa en lata',
  -- Quesos curados con alto sodio
  'Queso Curado', 'Queso Rallado Grana Padano',
  -- Snacks/picatostes procesados con sal
  'Picatostes de ajo', 'Picatostes Tostados'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── HIPERTENSIÓN: recommend (potasio, omega-3, antiinflamatorio) ──
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Hipertensión') c
WHERE f.name IN (
  -- Potasio alto: contrarresta retención sódica
  'Aguacate', 'Aguacate pequeño', 'Plátano', 'Boniato',
  'Espinacas', 'Brócoli',
  -- Omega-3: antiinflamatorio vascular
  'Salmón', 'Caballa',
  -- Legumbres: fibra, potasio
  'Garbanzos Cocidos', 'Lentejas Cocidas',
  -- Grasa antiinflamatoria
  'AOVE',
  -- Omega-3 vegetal, magnesio
  'Semillas de chía', 'Lino'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── HIPERCOLESTEROLEMIA: avoid (grasas saturadas/trans) ──────
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'avoid'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Hipercolesterolemia') c
WHERE f.name IN (
  -- Grasas saturadas puras
  'Mantequilla',
  -- Aceite de coco: >90% grasa saturada
  'Aceite de coco',
  -- Margarina: grasas trans
  'Margarina',
  -- Quesos grasos curados
  'Queso Curado', 'Queso Rallado Grana Padano',
  -- Lácteo completo: grasa saturada elevada
  'Leche Entera',
  -- Coco: grasa saturada alta
  'Coco rallado',
  -- Carne roja: grasa saturada + colesterol
  'Ternera Picada',
  -- Procesado con grasa saturada
  'Galletas Digestive'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── HIPERCOLESTEROLEMIA: recommend (insaturados, fibra, omega-3) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Hipercolesterolemia') c
WHERE f.name IN (
  -- Grasas monoinsaturadas
  'AOVE', 'Aguacate', 'Aguacate pequeño', 'Almendra',
  -- Omega-3 marino: reduce triglicéridos, sube HDL
  'Salmón', 'Caballa', 'Sardinas en lata',
  -- Omega-3 vegetal
  'Nueces', 'Lino', 'Semillas de chía',
  -- Fibra soluble: reduce absorción de colesterol LDL
  'Garbanzos Cocidos', 'Lentejas Cocidas', 'Avena',
  'Arroz Integral'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── ANEMIA FERROPÉNICA: avoid (inhibidores absorción hierro) ─
-- NOTA: La evidencia indica que polifenoles del cacao/chocolate inhiben
-- la absorción de hierro no hemo si se consumen juntos. Confianza reducida.
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'avoid'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Anemia ferropénica') c
WHERE f.name IN (
  'Cacao desgrasado', 'Chocolate 72%', 'Chocolate 99%', 'Chocolate negro'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── ANEMIA FERROPÉNICA: recommend (hierro hemo y no hemo, vit C) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Anemia ferropénica') c
WHERE f.name IN (
  -- Hierro hemo (mayor biodisponibilidad)
  'Hígado de pollo', 'Hígado de ternera',
  -- Hierro no hemo + vitamina C (mejora absorción)
  'Espinacas', 'Brócoli', 'Col rizada', 'Pimientos',
  -- Legumbres: hierro no hemo
  'Lentejas Cocidas', 'Garbanzos Cocidos', 'Judías pintas',
  -- Semillas: hierro
  'Pipas de calabaza', 'Semillas de chía', 'Lino'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── OSTEOPOROSIS: solo recommend (calcio, vitamina K, proteína) ─
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (SELECT id FROM public.medical_conditions WHERE name = 'Osteoporosis') c
WHERE f.name IN (
  -- Calcio lácteo: alta biodisponibilidad
  'Leche de vaca', 'Yogur griego', 'Yogur natural', 'Queso fresco',
  'Queso Fresco Batido 0%',
  -- Calcio vegetal + vitamina K
  'Col rizada', 'Brócoli',
  -- Calcio: semillas y frutos secos
  'Semillas de chía', 'Almendra',
  -- Calcio óseo (sardinas con espinas)
  'Sardinas en lata',
  -- Calcio + proteína
  'Judías pintas'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── ERGE / REFLUJO: avoid (ácidos, estimulantes, grasas) ─────
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'avoid'
FROM public.food f
CROSS JOIN (
  SELECT id FROM public.medical_conditions
  WHERE name = 'Reflujo gastroesofágico (ERGE)'
) c
WHERE f.name IN (
  -- Ácidos: irritan mucosa esofágica
  'Tomate', 'Salsa de Tomate "Solís"', 'Salsa Tomate Albahaca',
  -- Estimulantes: relajan esfínter esofágico inferior
  'Cacao desgrasado', 'Chocolate 72%', 'Chocolate 99%', 'Chocolate negro',
  -- Grasas saturadas: retrasan vaciado gástrico y relajan EEI
  'Aceite de coco', 'Mantequilla',
  -- Triggers comunes: irritantes para EEI
  'Ajo', 'Cebolla',
  -- Procesado graso
  'Galletas Digestive'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;

-- ── ERGE / REFLUJO: recommend (alcalinos, digestión fácil) ───
INSERT INTO public.food_medical_conditions (food_id, condition_id, relation_type)
SELECT f.id, c.id, 'recommend'
FROM public.food f
CROSS JOIN (
  SELECT id FROM public.medical_conditions
  WHERE name = 'Reflujo gastroesofágico (ERGE)'
) c
WHERE f.name IN (
  -- Neutros/alcalinos: no irritan mucosa
  'Arroz', 'Arroz Integral', 'Avena',
  -- Verduras alcalinas: baja acidez
  'Boniato', 'Calabacín', 'Espárragos', 'Zanahoria'
)
ON CONFLICT (food_id, condition_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SECCIÓN B: food_substitution_mappings
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- BLOQUE 1: HIPERTENSIÓN
-- Sub-grupos:
--   embutido_curado → proteína baja en sodio
--   condimento_sal  → caldo / aceite sin sodio
--   salsa_industrial → tomate fresco / caldo
--   conserva_pescado → pescado fresco sin sal
--   queso_curado    → queso fresco (menos sodio)
--   snack_sal       → snack sin sal
-- ────────────────────────────────────────────────────────────
WITH condition AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions WHERE name = 'Hipertensión'
),
source_foods AS (
  SELECT
    c.condition_id, c.condition_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('condition_avoid:%s', c.condition_id) AS context_key,
    CASE
      WHEN f.name = 'Jamón serrano'                THEN 'embutido_curado'
      WHEN f.name = 'Salsa soja'                   THEN 'condimento_sal'
      WHEN f.name IN ('Salsa de Tomate "Solís"', 'Salsa Tomate Albahaca')
                                                   THEN 'salsa_industrial'
      WHEN f.name IN ('Sardinas en lata','Atún en Lata Natural (80g)','Caballa en lata')
                                                   THEN 'conserva_pescado'
      WHEN f.name IN ('Queso Curado','Queso Rallado Grana Padano')
                                                   THEN 'queso_curado'
      WHEN f.name IN ('Picatostes de ajo','Picatostes Tostados')
                                                   THEN 'snack_sal'
      ELSE 'general'
    END AS sub_group
  FROM public.food_medical_conditions fmc
  JOIN public.food f ON f.id = fmc.food_id
  JOIN condition c   ON c.condition_id = fmc.condition_id
  WHERE fmc.relation_type = 'avoid'
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name
  FROM public.food f
  WHERE f.name IN (
    'Jamón cocido (85%)', 'Pechuga de Pollo', 'Pavo',
    'Caldo de verduras', 'AOVE',
    'Tomate',
    'Abadejo', 'Bacalao', 'Lenguado', 'Rape',
    'Queso fresco', 'Queso Fresco Batido 0%',
    'Tortas de Arroz'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('embutido_curado',  'Jamón cocido (85%)',     93::numeric, 1),
    ('embutido_curado',  'Pechuga de Pollo',        88::numeric, 2),
    ('embutido_curado',  'Pavo',                    85::numeric, 3),
    ('condimento_sal',   'Caldo de verduras',        82::numeric, 1),
    ('condimento_sal',   'AOVE',                    75::numeric, 2),
    ('salsa_industrial', 'Tomate',                  90::numeric, 1),
    ('salsa_industrial', 'Caldo de verduras',        78::numeric, 2),
    ('conserva_pescado', 'Abadejo',                  92::numeric, 1),
    ('conserva_pescado', 'Bacalao',                  90::numeric, 2),
    ('conserva_pescado', 'Lenguado',                 88::numeric, 3),
    ('conserva_pescado', 'Rape',                     85::numeric, 4),
    ('queso_curado',     'Queso fresco',             90::numeric, 1),
    ('queso_curado',     'Queso Fresco Batido 0%',   87::numeric, 2),
    ('snack_sal',        'Tortas de Arroz',          85::numeric, 1),
    ('general',          'Pechuga de Pollo',         78::numeric, 1),
    ('general',          'Caldo de verduras',         72::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT sf.condition_id, sf.condition_name,
    sf.source_food_id, sf.source_food_name, sf.context_key,
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
  UPDATE public.food_substitution_mappings fsm SET
    substitution_type = 'nutritional_equivalent',
    confidence_score  = c.confidence_score,
    reason = c.reason, is_automatic = true,
    metadata = jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key
  RETURNING fsm.id
),
creator AS (SELECT p.user_id FROM public.profiles p ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata)
  SELECT c.source_food_id, c.target_food_id, 'nutritional_equivalent',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key)
  RETURNING id
)
SELECT 'Hipertensión' AS condition,
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)   AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)  AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 2: HIPERCOLESTEROLEMIA
-- Sub-grupos:
--   grasa_sat    → grasa insaturada (AOVE, aceite girasol)
--   queso_graso  → queso fresco (menos saturada)
--   lacteo_graso → lácteo desnatado / vegetal
--   carne_roja   → proteína magra
--   snack_graso  → snack sin grasa trans/sat
-- ────────────────────────────────────────────────────────────
WITH condition AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions WHERE name = 'Hipercolesterolemia'
),
source_foods AS (
  SELECT c.condition_id, c.condition_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('condition_avoid:%s', c.condition_id) AS context_key,
    CASE
      WHEN f.name IN ('Mantequilla','Aceite de coco','Margarina') THEN 'grasa_sat'
      WHEN f.name IN ('Queso Curado','Queso Rallado Grana Padano') THEN 'queso_graso'
      WHEN f.name = 'Leche Entera'    THEN 'lacteo_graso'
      WHEN f.name = 'Coco rallado'    THEN 'grasa_sat'
      WHEN f.name = 'Ternera Picada'  THEN 'carne_roja'
      WHEN f.name = 'Galletas Digestive' THEN 'snack_graso'
      ELSE 'general'
    END AS sub_group
  FROM public.food_medical_conditions fmc
  JOIN public.food f ON f.id = fmc.food_id
  JOIN condition c   ON c.condition_id = fmc.condition_id
  WHERE fmc.relation_type = 'avoid'
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name FROM public.food f
  WHERE f.name IN (
    'AOVE', 'Aceite de girasol',
    'Queso fresco', 'Queso Fresco Batido 0%',
    'Leche Desnatada Sin Lactosa', 'Bebida de Soja',
    'Pechuga de Pollo', 'Pavo', 'Lentejas Cocidas',
    'Semillas de chía', 'Lino',
    'Tortas de Arroz'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('grasa_sat',   'AOVE',                    95::numeric, 1),
    ('grasa_sat',   'Aceite de girasol',        88::numeric, 2),
    ('grasa_sat',   'Semillas de chía',          75::numeric, 3),
    ('grasa_sat',   'Lino',                     73::numeric, 4),
    ('queso_graso', 'Queso fresco',             90::numeric, 1),
    ('queso_graso', 'Queso Fresco Batido 0%',   87::numeric, 2),
    -- Leche Desnatada Sin Lactosa filtrada en runtime si usuario tiene Leche/Caseína
    ('lacteo_graso','Leche Desnatada Sin Lactosa', 90::numeric, 1),
    ('lacteo_graso','Bebida de Soja',            85::numeric, 2),
    ('carne_roja',  'Pechuga de Pollo',          92::numeric, 1),
    ('carne_roja',  'Pavo',                      90::numeric, 2),
    ('carne_roja',  'Lentejas Cocidas',           85::numeric, 3),
    ('snack_graso', 'Tortas de Arroz',           85::numeric, 1),
    ('general',     'AOVE',                      80::numeric, 1),
    ('general',     'Pechuga de Pollo',           75::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT sf.condition_id, sf.condition_name,
    sf.source_food_id, sf.source_food_name, sf.context_key,
    tc.target_food_id, tc.target_food_name, sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    condition_id, condition_name, source_food_id, source_food_name,
    target_food_id, target_food_name, confidence_score, preference_rank, context_key,
    format('%s en conflicto con Condición médica: %s. Se reemplaza por %s.',
      source_food_name, condition_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm SET
    substitution_type = 'nutritional_equivalent', confidence_score = c.confidence_score,
    reason = c.reason, is_automatic = true,
    metadata = jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key
  RETURNING fsm.id
),
creator AS (SELECT p.user_id FROM public.profiles p ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata)
  SELECT c.source_food_id, c.target_food_id, 'nutritional_equivalent',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key)
  RETURNING id
)
SELECT 'Hipercolesterolemia' AS condition,
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)   AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)  AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 3: ANEMIA FERROPÉNICA
-- Inhibidores de absorción de hierro → alternativas sin polifenoles
-- Confianza moderada (60-70): es una restricción de timing, no absoluta
-- ────────────────────────────────────────────────────────────
WITH condition AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions WHERE name = 'Anemia ferropénica'
),
source_foods AS (
  SELECT c.condition_id, c.condition_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('condition_avoid:%s', c.condition_id) AS context_key,
    'cacao_chocolate' AS sub_group
  FROM public.food_medical_conditions fmc
  JOIN public.food f ON f.id = fmc.food_id
  JOIN condition c   ON c.condition_id = fmc.condition_id
  WHERE fmc.relation_type = 'avoid'
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name FROM public.food f
  WHERE f.name IN ('Canela', 'Pipas de calabaza', 'Pipas de girasol')
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('cacao_chocolate', 'Canela',            68::numeric, 1),
    ('cacao_chocolate', 'Pipas de calabaza', 65::numeric, 2),
    ('cacao_chocolate', 'Pipas de girasol',  63::numeric, 3)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT sf.condition_id, sf.condition_name,
    sf.source_food_id, sf.source_food_name, sf.context_key,
    tc.target_food_id, tc.target_food_name, sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    condition_id, condition_name, source_food_id, source_food_name,
    target_food_id, target_food_name, confidence_score, preference_rank, context_key,
    format('%s puede inhibir absorción de hierro (%s). Alternativa: %s.',
      source_food_name, condition_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm SET
    substitution_type = 'nutritional_equivalent', confidence_score = c.confidence_score,
    reason = c.reason, is_automatic = false,  -- confianza baja → no automático
    metadata = jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key
  RETURNING fsm.id
),
creator AS (SELECT p.user_id FROM public.profiles p ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata)
  SELECT c.source_food_id, c.target_food_id, 'nutritional_equivalent',
    c.confidence_score, c.reason,
    false,  -- is_automatic = false: evidencia moderada, requiere revisión
    cr.user_id,
    jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key)
  RETURNING id
)
SELECT 'Anemia ferropénica' AS condition,
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)   AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)  AS inserted_count;


-- ────────────────────────────────────────────────────────────
-- BLOQUE 4: ERGE / REFLUJO
-- Sub-grupos:
--   acido_tomate  → verdura neutra de base para cocinar
--   estimulante   → especias suaves sin efecto en EEI
--   grasa_sat_erge → grasa insaturada de fácil digestión
--   trigger_erge  → alternativa aromática más tolerable
--   snack_graso   → snack de fácil digestión
-- ────────────────────────────────────────────────────────────
WITH condition AS (
  SELECT id AS condition_id, name AS condition_name
  FROM public.medical_conditions WHERE name = 'Reflujo gastroesofágico (ERGE)'
),
source_foods AS (
  SELECT c.condition_id, c.condition_name,
    f.id AS source_food_id, f.name AS source_food_name,
    format('condition_avoid:%s', c.condition_id) AS context_key,
    CASE
      WHEN f.name IN ('Tomate','Salsa de Tomate "Solís"','Salsa Tomate Albahaca')
        THEN 'acido_tomate'
      WHEN f.name IN ('Cacao desgrasado','Chocolate 72%','Chocolate 99%','Chocolate negro')
        THEN 'estimulante'
      WHEN f.name IN ('Aceite de coco','Mantequilla')
        THEN 'grasa_sat_erge'
      WHEN f.name = 'Ajo'    THEN 'trigger_ajo'
      WHEN f.name = 'Cebolla' THEN 'trigger_cebolla'
      WHEN f.name = 'Galletas Digestive' THEN 'snack_graso'
      ELSE 'general'
    END AS sub_group
  FROM public.food_medical_conditions fmc
  JOIN public.food f ON f.id = fmc.food_id
  JOIN condition c   ON c.condition_id = fmc.condition_id
  WHERE fmc.relation_type = 'avoid'
),
target_catalog AS (
  SELECT f.id AS target_food_id, f.name AS target_food_name FROM public.food f
  WHERE f.name IN (
    'Calabacín', 'Pimientos', 'Zanahoria', 'Caldo de verduras',
    'Canela',
    'AOVE',
    'Perejil', 'Puerro',
    'Tortas de Arroz'
  )
),
sub_group_prefs AS (
  SELECT sub_group, target_food_name, confidence_score, preference_rank
  FROM (VALUES
    ('acido_tomate',   'Calabacín',        88::numeric, 1),
    ('acido_tomate',   'Pimientos',         82::numeric, 2),
    ('acido_tomate',   'Caldo de verduras', 75::numeric, 3),
    ('estimulante',    'Canela',            70::numeric, 1),
    ('grasa_sat_erge', 'AOVE',              93::numeric, 1),
    ('trigger_ajo',    'Perejil',           80::numeric, 1),
    ('trigger_cebolla','Puerro',            82::numeric, 1),
    ('snack_graso',    'Tortas de Arroz',   85::numeric, 1),
    ('general',        'Calabacín',         72::numeric, 1),
    ('general',        'Zanahoria',         70::numeric, 2)
  ) AS t(sub_group, target_food_name, confidence_score, preference_rank)
),
candidate_rows_raw AS (
  SELECT sf.condition_id, sf.condition_name,
    sf.source_food_id, sf.source_food_name, sf.context_key,
    tc.target_food_id, tc.target_food_name, sgp.confidence_score, sgp.preference_rank
  FROM source_foods sf
  JOIN sub_group_prefs sgp ON sgp.sub_group = sf.sub_group
  JOIN target_catalog tc   ON tc.target_food_name = sgp.target_food_name
  WHERE sf.source_food_id <> tc.target_food_id
),
candidate_rows AS (
  SELECT DISTINCT ON (source_food_id, target_food_id, context_key)
    condition_id, condition_name, source_food_id, source_food_name,
    target_food_id, target_food_name, confidence_score, preference_rank, context_key,
    format('%s en conflicto con Condición médica: %s. Se reemplaza por %s.',
      source_food_name, condition_name, target_food_name) AS reason
  FROM candidate_rows_raw
  ORDER BY source_food_id, target_food_id, context_key, confidence_score DESC, preference_rank ASC
),
updated_rows AS (
  UPDATE public.food_substitution_mappings fsm SET
    substitution_type = 'nutritional_equivalent', confidence_score = c.confidence_score,
    reason = c.reason, is_automatic = true,
    metadata = jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c
  WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
    AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key
  RETURNING fsm.id
),
creator AS (SELECT p.user_id FROM public.profiles p ORDER BY p.created_at NULLS LAST, p.user_id LIMIT 1),
inserted_rows AS (
  INSERT INTO public.food_substitution_mappings (
    source_food_id, target_food_id, substitution_type,
    confidence_score, reason, is_automatic, created_by, metadata)
  SELECT c.source_food_id, c.target_food_id, 'nutritional_equivalent',
    c.confidence_score, c.reason, true, cr.user_id,
    jsonb_build_object('context_key', c.context_key,
      'conflict_contexts', jsonb_build_array(jsonb_build_object(
        'type','medical_condition','condition_id',c.condition_id,
        'condition_name',c.condition_name,'relation_type','avoid')))
  FROM candidate_rows c JOIN creator cr ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.food_substitution_mappings fsm
    WHERE fsm.source_food_id = c.source_food_id AND fsm.target_food_id = c.target_food_id
      AND COALESCE(NULLIF(fsm.metadata->>'context_key',''),'general') = c.context_key)
  RETURNING id
)
SELECT 'ERGE / Reflujo' AS condition,
  (SELECT COUNT(*) FROM candidate_rows) AS candidate_rows_count,
  (SELECT COUNT(*) FROM updated_rows)   AS updated_count,
  (SELECT COUNT(*) FROM inserted_rows)  AS inserted_count;
