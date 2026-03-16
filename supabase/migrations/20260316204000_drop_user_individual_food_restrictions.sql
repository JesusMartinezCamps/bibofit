-- ============================================================
-- MIGRATION: Eliminar user_individual_food_restrictions
--
-- Esta tabla nunca tuvo camino de escritura desde el frontend
-- (cero INSERTs ni UPDATEs en todo el código fuente).
-- La funcionalidad de restricción de alimentos individuales
-- queda cubierta por preferred_foods / non_preferred_foods.
-- ============================================================

-- 1. Actualizar get_user_restrictions para eliminar individual_food_restrictions
CREATE OR REPLACE FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
  sensitivities_data        jsonb;
  conditions_data           jsonb;
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
    'individual_food_restrictions', '[]'::jsonb,  -- campo eliminado, devuelto vacío por compatibilidad
    'diet_type_id',              diet_type_id_val,
    'diet_type_name',            diet_type_name_val,
    'diet_type_rules',           diet_type_rules_data
  );
END;
$$;

ALTER FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") OWNER TO "postgres";

-- 2. Actualizar clone_diet_plan_with_restrictions para eliminar la lógica de restricted foods
CREATE OR REPLACE FUNCTION "public"."clone_diet_plan_with_restrictions"(
    "template_id" bigint,
    "client_id"   "uuid",
    "new_plan_name" "text",
    "new_start_date" "date",
    "new_end_date"   "date"
)
RETURNS bigint
LANGUAGE "plpgsql"
SET "search_path" TO 'public'
AS $$
DECLARE
    new_plan_id bigint;
    template_recipe record;
    new_diet_plan_recipe_id bigint;
    ingredient record;
    user_meal_ids bigint[];
    user_pathology_ids bigint[];
    recipe_pathology_ids bigint[];
    has_conflict boolean;
BEGIN
    SELECT array_agg(day_meal_id) INTO user_meal_ids FROM public.user_day_meals WHERE user_id = client_id;
    SELECT array_agg(pathology_id) INTO user_pathology_ids FROM public.user_pathologies WHERE user_id = client_id;

    INSERT INTO public.diet_plans (user_id, name, start_date, end_date, protein_pct, carbs_pct, fat_pct, is_active, is_template, source_template_id)
    SELECT client_id, new_plan_name, new_start_date, new_end_date, protein_pct, carbs_pct, fat_pct, false, false, template_id
    FROM public.diet_plans
    WHERE id = template_id AND is_template = true
    RETURNING id INTO new_plan_id;

    IF new_plan_id IS NULL THEN
        RETURN NULL;
    END IF;

    FOR template_recipe IN SELECT * FROM public.diet_plan_recipes WHERE diet_plan_id = template_id LOOP
        IF user_meal_ids IS NULL OR NOT (template_recipe.day_meal_id = ANY(user_meal_ids)) THEN
            CONTINUE;
        END IF;

        has_conflict := false;

        IF user_pathology_ids IS NOT NULL THEN
            SELECT array_agg(pathology_id) INTO recipe_pathology_ids FROM public.recipe_pathologies WHERE recipe_id = template_recipe.recipe_id;
            IF recipe_pathology_ids IS NOT NULL THEN
                SELECT EXISTS (
                    SELECT 1 FROM unnest(user_pathology_ids) u_path_id
                    JOIN unnest(recipe_pathology_ids) r_path_id ON u_path_id = r_path_id
                ) INTO has_conflict;
            END IF;
        END IF;

        IF NOT has_conflict THEN
            INSERT INTO public.diet_plan_recipes (diet_plan_id, recipe_id, day_of_week, day_meal_id, is_customized)
            VALUES (new_plan_id, template_recipe.recipe_id, template_recipe.day_of_week, template_recipe.day_meal_id, false)
            RETURNING id INTO new_diet_plan_recipe_id;

            FOR ingredient IN SELECT * FROM public.recipe_ingredients WHERE recipe_id = template_recipe.recipe_id LOOP
                INSERT INTO public.diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
                VALUES (new_diet_plan_recipe_id, ingredient.food_id, ingredient.grams);
            END LOOP;
        END IF;
    END LOOP;

    RETURN new_plan_id;
END;
$$;

ALTER FUNCTION "public"."clone_diet_plan_with_restrictions"("template_id" bigint, "client_id" "uuid", "new_plan_name" "text", "new_start_date" "date", "new_end_date" "date") OWNER TO "postgres";

-- 3. Eliminar la tabla (las FK con ON DELETE CASCADE harán limpieza automática)
DROP TABLE IF EXISTS public.user_individual_food_restrictions;
