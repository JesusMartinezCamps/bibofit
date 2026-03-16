-- ============================================================
-- MIGRATION: Diet Type → Food Group Rules
-- Sistema de advertencias por tipo de dieta.
-- Los alimentos incompatibles se marcan como advertencia
-- (no se bloquean — el usuario puede seleccionarlos).
--
-- food_groups reales en la BD:
--  1  Verduras y hortalizas          13 Carnes blancas
--  2  Frutas                         14 Carnes rojas
--  3  Legumbres                      15 Pescados blancos
--  4  Frutos secos                   16 Pescados azules
--  5  Semillas                       17 Mariscos y moluscos
--  6  Cereales                       18 Huevos
--  7  Tubérculos y raíces            19 Lácteos
--  8  Derivados vegetales            20 Derivados animales
--  9  Bebidas vegetales              21 Ultraprocesados y snacks
-- 10  Algas comestibles              26 Pseudocereales
-- 11  Aceites vegetales              30 Panes
-- 12  Productos fermentados veg.     31 Pastas
--                                    34 Fermentado
--                                    35 Carbohidrato Simple
--                                    32 Salsas
-- ============================================================

-- ============================================================
-- 1. NUEVOS TIPOS DE DIETA (los 8 existentes no se tocan)
-- ============================================================

INSERT INTO public.diet_types (name, description)
VALUES
  (
    'Flexitariana',
    'Dieta principalmente vegetal con consumo muy ocasional y reducido de carne o pescado. Más flexible que la vegetariana, combina beneficios de las dietas plant-based con la practicidad social. Asociada a menor riesgo metabólico y cardiovascular sin requerir restricciones estrictas.'
  ),
  (
    'Cetogénica',
    'Patrón muy bajo en carbohidratos (< 50 g/día) y alto en grasas que induce cetosis. Eficaz para pérdida de peso rápida, control glucémico en diabetes tipo 2 y epilepsia refractaria. Requiere seguimiento cuidadoso y puede ser difícil de mantener a largo plazo.'
  ),
  (
    'Paleo',
    'Basada en alimentos que se presumen consumidos en el paleolítico: carnes magras, pescado, huevos, vegetales, frutas y frutos secos. Excluye cereales, legumbres, lácteos y procesados. Asociada a mejoras en composición corporal y marcadores glucémicos.'
  ),
  (
    'Alta en Proteínas',
    'Patrón que prioriza la ingesta proteica (> 25-30% del total calórico). Especialmente útil en contextos de ganancia muscular, pérdida de grasa con preservación de masa magra, o recuperación deportiva. Compatible con múltiples patrones dietéticos.'
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. TABLA DE REGLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diet_type_food_group_rules (
  diet_type_id  bigint NOT NULL REFERENCES public.diet_types(id)  ON DELETE CASCADE,
  food_group_id bigint NOT NULL REFERENCES public.food_groups(id) ON DELETE CASCADE,
  rule_type     text   NOT NULL CHECK (rule_type IN ('excluded', 'limited')),
  -- excluded → advertencia roja: no compatible con la dieta
  -- limited  → advertencia naranja: uso reducido recomendado
  PRIMARY KEY (diet_type_id, food_group_id)
);

COMMENT ON TABLE public.diet_type_food_group_rules IS
  'Grupos de alimentos incompatibles (excluded) o de uso reducido (limited) por tipo de dieta. Genera advertencias, no bloqueos.';

ALTER TABLE public.diet_type_food_group_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read access"
  ON public.diet_type_food_group_rules;
CREATE POLICY "Allow authenticated read access"
  ON public.diet_type_food_group_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin full access"
  ON public.diet_type_food_group_rules;
CREATE POLICY "Allow admin full access"
  ON public.diet_type_food_group_rules
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.diet_type_food_group_rules TO authenticated, anon;
GRANT ALL   ON public.diet_type_food_group_rules TO service_role;

-- ============================================================
-- 3. SEED DE REGLAS (IDs de food_groups verificados en BD)
-- ============================================================

INSERT INTO public.diet_type_food_group_rules (diet_type_id, food_group_id, rule_type)
VALUES

-- ── OMNÍVORA (id=1): sin restricciones ──────────────────────
-- (sin reglas)

-- ── VEGANA ESTRICTA (id=2): 100% vegetal ─────────────────────
-- Excluye todos los productos de origen animal
  (2, 13, 'excluded'),   -- Carnes blancas
  (2, 14, 'excluded'),   -- Carnes rojas
  (2, 15, 'excluded'),   -- Pescados blancos
  (2, 16, 'excluded'),   -- Pescados azules
  (2, 17, 'excluded'),   -- Mariscos y moluscos
  (2, 18, 'excluded'),   -- Huevos
  (2, 19, 'excluded'),   -- Lácteos
  (2, 20, 'excluded'),   -- Derivados animales (gelatina, caldos de carne…)
  (2, 34, 'limited'),    -- Fermentado (yogur/kéfir son animales; kombucha/miso son veganos)
  (2, 21, 'limited'),    -- Ultraprocesados y snacks (pueden llevar ingredientes animales)

-- ── BASADA EN PLANTAS FLEXIBLE (id=3): principalmente vegetal
-- Limita (no excluye) productos animales
  (3, 13, 'limited'),    -- Carnes blancas
  (3, 14, 'limited'),    -- Carnes rojas
  (3, 15, 'limited'),    -- Pescados blancos
  (3, 16, 'limited'),    -- Pescados azules
  (3, 17, 'limited'),    -- Mariscos y moluscos
  (3, 20, 'limited'),    -- Derivados animales
  (3, 21, 'limited'),    -- Ultraprocesados y snacks

-- ── VEGETARIANA ESTRICTA (id=4): sin carne ni pescado ────────
-- Permite huevos y lácteos
  (4, 13, 'excluded'),   -- Carnes blancas
  (4, 14, 'excluded'),   -- Carnes rojas
  (4, 15, 'excluded'),   -- Pescados blancos
  (4, 16, 'excluded'),   -- Pescados azules
  (4, 17, 'excluded'),   -- Mariscos y moluscos
  (4, 20, 'limited'),    -- Derivados animales (gelatina, caldos de carne…)
  (4, 21, 'limited'),    -- Ultraprocesados (pueden contener carne/pescado)

-- ── LACTOVEGETARIANA (id=5): sin carne, pescado ni huevos ────
-- Permite lácteos
  (5, 13, 'excluded'),   -- Carnes blancas
  (5, 14, 'excluded'),   -- Carnes rojas
  (5, 15, 'excluded'),   -- Pescados blancos
  (5, 16, 'excluded'),   -- Pescados azules
  (5, 17, 'excluded'),   -- Mariscos y moluscos
  (5, 18, 'excluded'),   -- Huevos
  (5, 20, 'limited'),    -- Derivados animales
  (5, 21, 'limited'),    -- Ultraprocesados

-- ── PESCETARIANA (id=6): sin carne terrestre ─────────────────
-- Permite pescado, marisco, huevos y lácteos
  (6, 13, 'excluded'),   -- Carnes blancas
  (6, 14, 'excluded'),   -- Carnes rojas
  (6, 20, 'limited'),    -- Derivados animales
  (6, 21, 'limited'),    -- Ultraprocesados

-- ── MEDITERRÁNEA (id=7) ───────────────────────────────────────
  (7, 14, 'limited'),    -- Carnes rojas (consumo ocasional)
  (7, 21, 'excluded'),   -- Ultraprocesados y snacks (contrario al patrón mediterráneo)
  (7, 35, 'limited'),    -- Carbohidrato Simple (azúcares añadidos)

-- ── DASH (id=8): control de sodio y azúcares ─────────────────
  (8, 21, 'excluded'),   -- Ultraprocesados y snacks
  (8, 35, 'limited'),    -- Carbohidrato Simple
  (8, 32, 'limited'),    -- Salsas (altas en sodio)

-- ── FLEXITARIANA: carne muy ocasional ────────────────────────
  ((SELECT id FROM public.diet_types WHERE name = 'Flexitariana'), 13, 'limited'),   -- Carnes blancas
  ((SELECT id FROM public.diet_types WHERE name = 'Flexitariana'), 14, 'limited'),   -- Carnes rojas
  ((SELECT id FROM public.diet_types WHERE name = 'Flexitariana'), 21, 'limited'),   -- Ultraprocesados

-- ── CETOGÉNICA: muy baja en carbohidratos ────────────────────
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'),  6, 'excluded'),   -- Cereales
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'),  7, 'excluded'),   -- Tubérculos y raíces
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'),  3, 'excluded'),   -- Legumbres
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'), 26, 'excluded'),   -- Pseudocereales
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'), 30, 'excluded'),   -- Panes
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'), 31, 'excluded'),   -- Pastas
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'), 35, 'excluded'),   -- Carbohidrato Simple
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'), 21, 'excluded'),   -- Ultraprocesados
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'),  2, 'limited'),    -- Frutas (frutos rojos OK, resto no)
  ((SELECT id FROM public.diet_types WHERE name = 'Cetogénica'),  9, 'limited'),    -- Bebidas vegetales (pueden llevar azúcar)

-- ── PALEO: sin cereales, legumbres, lácteos ni procesados ────
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'),  6, 'excluded'),   -- Cereales
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'),  3, 'excluded'),   -- Legumbres
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 19, 'excluded'),   -- Lácteos
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 26, 'excluded'),   -- Pseudocereales
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 30, 'excluded'),   -- Panes
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 31, 'excluded'),   -- Pastas
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 35, 'excluded'),   -- Carbohidrato Simple
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'), 21, 'excluded'),   -- Ultraprocesados
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'),  7, 'limited'),    -- Tubérculos (boniato aceptado en algunas versiones)
  ((SELECT id FROM public.diet_types WHERE name = 'Paleo'),  8, 'limited'),    -- Derivados vegetales (soja debatida en Paleo)

-- ── ALTA EN PROTEÍNAS: énfasis proteico, sin exclusiones duras
  ((SELECT id FROM public.diet_types WHERE name = 'Alta en Proteínas'), 35, 'limited'),  -- Carbohidrato Simple
  ((SELECT id FROM public.diet_types WHERE name = 'Alta en Proteínas'), 21, 'limited')   -- Ultraprocesados

ON CONFLICT (diet_type_id, food_group_id) DO NOTHING;
