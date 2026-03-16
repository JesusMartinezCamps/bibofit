-- ============================================================
-- MIGRATION: Actualizar get_user_restrictions() para incluir
-- diet_type_id, diet_type_name y diet_type_rules del usuario.
--
-- Todos los lugares que llaman a esta función RPC recibirán
-- automáticamente los datos de tipo de dieta sin cambiar
-- ningún código de frontend en los call sites.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
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
    'sensitivities',             sensitivities_data,
    'medical_conditions',        conditions_data,
    'individual_food_restrictions', food_restrictions_data,
    'diet_type_id',              diet_type_id_val,
    'diet_type_name',            diet_type_name_val,
    'diet_type_rules',           diet_type_rules_data
  );
END;
$$;

ALTER FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") OWNER TO "postgres";
