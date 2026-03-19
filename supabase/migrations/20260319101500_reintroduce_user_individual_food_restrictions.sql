-- ============================================================
-- MIGRATION: Reintroducir restricciones individuales por alimento
--
-- Objetivo:
-- - Permitir que un usuario marque alimentos concretos como conflictivos
--   (ej. melon, tomate) sin depender de una sensibilidad global.
-- - Mantener el modelo actual de sensitivities/food_sensitivities intacto.
-- ============================================================

-- 1) Tabla pivote usuario <-> alimento restringido
CREATE TABLE IF NOT EXISTS public.user_individual_food_restrictions (
  user_id uuid NOT NULL,
  food_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_individual_food_restrictions_pkey PRIMARY KEY (user_id, food_id),
  CONSTRAINT user_individual_food_restrictions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  CONSTRAINT user_individual_food_restrictions_food_id_fkey
    FOREIGN KEY (food_id) REFERENCES public.food(id) ON DELETE CASCADE
);

-- 2) RLS + grants
ALTER TABLE public.user_individual_food_restrictions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.user_individual_food_restrictions TO anon;
GRANT ALL ON TABLE public.user_individual_food_restrictions TO authenticated;
GRANT ALL ON TABLE public.user_individual_food_restrictions TO service_role;

DROP POLICY IF EXISTS "Allow users to manage their own individual food restrictions"
  ON public.user_individual_food_restrictions;
CREATE POLICY "Allow users to manage their own individual food restrictions"
  ON public.user_individual_food_restrictions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admin full access on individual food restrictions"
  ON public.user_individual_food_restrictions;
CREATE POLICY "Allow admin full access on individual food restrictions"
  ON public.user_individual_food_restrictions
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Coaches can manage individual food restrictions for clients"
  ON public.user_individual_food_restrictions;
CREATE POLICY "Coaches can manage individual food restrictions for clients"
  ON public.user_individual_food_restrictions
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_clients
      WHERE coach_clients.coach_id = auth.uid()
        AND coach_clients.client_id = user_individual_food_restrictions.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.coach_clients
      WHERE coach_clients.coach_id = auth.uid()
        AND coach_clients.client_id = user_individual_food_restrictions.user_id
    )
  );

-- 3) RPC centralizado: devolver restricciones individuales reales
CREATE OR REPLACE FUNCTION public.get_user_restrictions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  sensitivities_data        jsonb;
  conditions_data           jsonb;
  food_restrictions_data    jsonb;
  diet_type_id_val          bigint;
  diet_type_name_val        text;
  diet_type_rules_data      jsonb;
BEGIN
  -- Sensibilidades del usuario
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)), '[]'::jsonb)
    INTO sensitivities_data
  FROM public.user_sensitivities us
  JOIN public.sensitivities s ON us.sensitivity_id = s.id
  WHERE us.user_id = p_user_id;

  -- Condiciones médicas del usuario
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name)), '[]'::jsonb)
    INTO conditions_data
  FROM public.user_medical_conditions umc
  JOIN public.medical_conditions mc ON umc.condition_id = mc.id
  WHERE umc.user_id = p_user_id;

  -- Restricciones individuales de alimento
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name)), '[]'::jsonb)
    INTO food_restrictions_data
  FROM public.user_individual_food_restrictions uifr
  JOIN public.food f ON uifr.food_id = f.id
  WHERE uifr.user_id = p_user_id;

  -- Tipo de dieta del usuario (desde diet_preferences)
  SELECT dp.diet_type_id, dt.name
    INTO diet_type_id_val, diet_type_name_val
  FROM public.diet_preferences dp
  LEFT JOIN public.diet_types dt ON dp.diet_type_id = dt.id
  WHERE dp.user_id = p_user_id
  LIMIT 1;

  -- Reglas del tipo de dieta (si tiene uno asignado)
  IF diet_type_id_val IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'food_group_id', r.food_group_id,
          'food_group_name', fg.name,
          'rule_type', r.rule_type
        )
      ),
      '[]'::jsonb
    )
      INTO diet_type_rules_data
    FROM public.diet_type_food_group_rules r
    JOIN public.food_groups fg ON r.food_group_id = fg.id
    WHERE r.diet_type_id = diet_type_id_val;
  ELSE
    diet_type_rules_data := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'sensitivities', sensitivities_data,
    'medical_conditions', conditions_data,
    'individual_food_restrictions', food_restrictions_data,
    'diet_type_id', diet_type_id_val,
    'diet_type_name', diet_type_name_val,
    'diet_type_rules', diet_type_rules_data
  );
END;
$$;

ALTER FUNCTION public.get_user_restrictions(p_user_id uuid) OWNER TO postgres;
