


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_recipe_id bigint;
    active_plan_id bigint;
    new_plan_recipe_id bigint;
    ingredient_record jsonb;
    error_details jsonb;
BEGIN
    -- Ensure the caller is an admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can perform this action';
    END IF;

    -- 1. Create the new global recipe
    INSERT INTO recipes (name, instructions, created_by)
    VALUES (p_recipe_name, p_instructions, p_user_id)
    RETURNING id INTO new_recipe_id;

    -- 2. Insert ingredients for the global recipe
    FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
    LOOP
        INSERT INTO recipe_ingredients (recipe_id, food_id, grams, food_group_id)
        VALUES (
            new_recipe_id,
            (ingredient_record->>'food_id')::bigint,
            (ingredient_record->>'grams')::integer,
            (ingredient_record->>'food_group_id')::bigint
        );
    END LOOP;

    -- 3. Find the active diet plan for the user
    SELECT id INTO active_plan_id
    FROM diet_plans
    WHERE user_id = p_user_id AND is_active = true
    LIMIT 1;

    -- 4. If an active plan exists, add the new recipe to it
    IF active_plan_id IS NOT NULL THEN
        -- 4a. Insert into diet_plan_recipes
        INSERT INTO diet_plan_recipes (diet_plan_id, recipe_id, day_meal_id, is_customized, custom_name, custom_instructions)
        VALUES (active_plan_id, new_recipe_id, p_day_meal_id, true, p_recipe_name, p_instructions)
        RETURNING id INTO new_plan_recipe_id;

        -- 4b. Insert ingredients into diet_plan_recipe_ingredients
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
            VALUES (
                new_plan_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'grams')::integer
            );
        END LOOP;
        
        RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', true);
    ELSE
        RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', false, 'reason', 'No active plan found');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_details = PG_EXCEPTION_DETAIL;
        RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'details', error_details);
END;
$$;


ALTER FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        new_recipe_id bigint;
        active_plan_id bigint;
        new_plan_recipe_id bigint;
        ingredient_record jsonb;
        error_details jsonb;
    BEGIN
        -- Ensure the caller is an admin
        IF NOT is_admin() THEN
            RAISE EXCEPTION 'Only admins can perform this action';
        END IF;

        -- 1. Create the new global recipe
        INSERT INTO recipes (name, instructions, prep_time_min, difficulty, created_by)
        VALUES (p_recipe_name, p_instructions, p_prep_time_min, p_difficulty, p_user_id)
        RETURNING id INTO new_recipe_id;

        -- 2. Insert ingredients for the global recipe
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO recipe_ingredients (recipe_id, food_id, grams, food_group_id)
            VALUES (
                new_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'grams')::integer,
                (ingredient_record->>'food_group_id')::bigint
            );
        END LOOP;

        -- 3. Find the active diet plan for the user
        SELECT id INTO active_plan_id
        FROM diet_plans
        WHERE user_id = p_user_id AND is_active = true
        LIMIT 1;

        -- 4. If an active plan exists, add the new recipe to it
        IF active_plan_id IS NOT NULL THEN
            -- 4a. Insert into diet_plan_recipes
            INSERT INTO diet_plan_recipes (diet_plan_id, recipe_id, day_meal_id, is_customized, custom_name, custom_instructions, custom_prep_time_min, custom_difficulty)
            VALUES (active_plan_id, new_recipe_id, p_day_meal_id, true, p_recipe_name, p_instructions, p_prep_time_min, p_difficulty)
            RETURNING id INTO new_plan_recipe_id;

            -- 4b. Insert ingredients into diet_plan_recipe_ingredients
            FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
            LOOP
                INSERT INTO diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
                VALUES (
                    new_plan_recipe_id,
                    (ingredient_record->>'food_id')::bigint,
                    (ingredient_record->>'grams')::integer
                );
            END LOOP;
            
            RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', true);
        ELSE
            RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', false, 'reason', 'No active plan found');
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS error_details = PG_EXCEPTION_DETAIL;
            RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'details', error_details);
    END;
    $$;


ALTER FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_day_meal_id bigint;
    v_diet_plan_id bigint;
    new_recipe_id bigint;
    new_diet_plan_recipe_id bigint;
    ingredient_record jsonb;
    occurrence_record record;
BEGIN
    -- Ensure the caller is an admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can perform this action';
    END IF;

    -- 1. Get info from the original free recipe
    SELECT user_id, diet_plan_id, day_meal_id
    INTO v_user_id, v_diet_plan_id, v_day_meal_id
    FROM free_recipes
    WHERE id = p_free_recipe_id;
    
    -- 2. Create the new global recipe
    INSERT INTO recipes (name, instructions, prep_time_min, difficulty, created_by)
    VALUES (
        p_recipe_data->>'name', 
        p_recipe_data->>'instructions', 
        (p_recipe_data->>'prep_time_min')::integer, 
        p_recipe_data->>'difficulty', 
        auth.uid() -- Admin creating it
    )
    RETURNING id INTO new_recipe_id;

    -- 3. Insert ingredients for the global recipe
    FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
    LOOP
        INSERT INTO recipe_ingredients (recipe_id, food_id, grams, food_group_id)
        VALUES (
            new_recipe_id,
            (ingredient_record->>'food_id')::bigint,
            (ingredient_record->>'grams')::integer,
            (ingredient_record->>'food_group_id')::bigint
        );
    END LOOP;

    -- 4. Add the new recipe to the user's diet plan
    IF v_diet_plan_id IS NOT NULL THEN
        -- Insert into diet_plan_recipes
        INSERT INTO diet_plan_recipes (
            diet_plan_id, 
            recipe_id, 
            day_meal_id, 
            is_customized, 
            custom_name, 
            custom_instructions, 
            custom_prep_time_min, 
            custom_difficulty
        )
        VALUES (
            v_diet_plan_id, 
            new_recipe_id, 
            v_day_meal_id, 
            true, -- Customized to preserve exact details from free recipe
            p_recipe_data->>'name', 
            p_recipe_data->>'instructions', 
            (p_recipe_data->>'prep_time_min')::integer, 
            p_recipe_data->>'difficulty'
        )
        RETURNING id INTO new_diet_plan_recipe_id;

        -- Insert ingredients into diet_plan_recipe_ingredients
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
            VALUES (
                new_diet_plan_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'grams')::integer
            );
        END LOOP;
        
        -- 5. Update daily_meal_logs to point to the new diet_plan_recipe
        FOR occurrence_record IN
            SELECT id FROM free_recipe_occurrences WHERE free_recipe_id = p_free_recipe_id
        LOOP
            UPDATE daily_meal_logs
            SET 
                diet_plan_recipe_id = new_diet_plan_recipe_id,
                free_recipe_occurrence_id = NULL
            WHERE free_recipe_occurrence_id = occurrence_record.id;
        END LOOP;

        -- 6. Migrate equivalence adjustments
        UPDATE equivalence_adjustments
        SET 
            source_diet_plan_recipe_id = new_diet_plan_recipe_id,
            source_free_recipe_id = NULL
        WHERE source_free_recipe_id = p_free_recipe_id;

        -- 7. Clean up the original free recipe and its components
        DELETE FROM free_recipe_occurrences WHERE free_recipe_id = p_free_recipe_id;
        DELETE FROM free_recipe_ingredients WHERE free_recipe_id = p_free_recipe_id;
        DELETE FROM free_recipes WHERE id = p_free_recipe_id;

        RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', true);
    ELSE
        -- Even if no diet plan found, we created the global recipe, but cannot replace assignment
        -- This case implies a data inconsistency if the free recipe didn't have a plan ID.
        -- We just return success on creation but note it wasn't added to plan.
        RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', false, 'reason', 'No diet plan ID found on free recipe');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_default_role_client"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into user_roles (user_id, role_id)
  values (new.id, (select id from roles where role = 'client'));
  return new;
end;
$$;


ALTER FUNCTION "public"."assign_default_role_client"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_diet_plan_recipe_ingredients"("_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated integer;
begin
  update public.diet_plan_recipe_ingredients t
  set grams = x.grams
  from jsonb_to_recordset(_rows) as x(id bigint, grams numeric)
  where t.id = x.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."bulk_update_diet_plan_recipe_ingredients"("_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_private_recipe_ingredients"("_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated integer;
begin
  update public.private_recipe_ingredients t
  set grams = x.grams
  from jsonb_to_recordset(_rows) as x(id bigint, grams numeric)
  where t.id = x.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."bulk_update_private_recipe_ingredients"("_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clone_diet_plan_template"("p_template_id" bigint, "p_client_id" "uuid", "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_plan_id bigint;
    template_recipe_entry record;
    original_recipe_details record;
    new_diet_plan_recipe_id bigint;
    ingredient record;
    macros record;
BEGIN
    -- 1. Crear el nuevo plan de dieta para el cliente
    INSERT INTO public.diet_plans (user_id, name, start_date, end_date, protein_pct, carbs_pct, fat_pct, is_active, is_template, source_template_id)
    SELECT
        p_client_id,
        p_new_plan_name,
        p_new_start_date,
        p_new_end_date,
        protein_pct,
        carbs_pct,
        fat_pct,
        true,
        false,
        p_template_id
    FROM public.diet_plans
    WHERE id = p_template_id AND is_template = true
    RETURNING id INTO new_plan_id;

    IF new_plan_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo crear el nuevo plan de dieta a partir de la plantilla.';
    END IF;

    -- 2. Recorrer las recetas de la plantilla y crear copias personalizadas para el nuevo plan
    FOR template_recipe_entry IN
        SELECT * FROM public.diet_plan_recipes WHERE diet_plan_id = p_template_id
    LOOP
        -- Obtener los detalles de la receta maestra original
        SELECT * INTO original_recipe_details FROM public.recipes WHERE id = template_recipe_entry.recipe_id;

        -- Insertar la nueva instancia de receta en diet_plan_recipes, marcándola como personalizada
        INSERT INTO public.diet_plan_recipes (
            diet_plan_id, 
            recipe_id,
            day_of_week, 
            day_meal_id, 
            is_customized, 
            custom_name, 
            custom_prep_time_min, 
            custom_difficulty, 
            custom_instructions
        )
        VALUES (
            new_plan_id,
            template_recipe_entry.recipe_id,
            template_recipe_entry.day_of_week,
            template_recipe_entry.day_meal_id,
            true, -- Se marca como 'customized' porque ahora es una copia independiente
            COALESCE(template_recipe_entry.custom_name, original_recipe_details.name),
            COALESCE(template_recipe_entry.custom_prep_time_min, original_recipe_details.prep_time_min),
            COALESCE(template_recipe_entry.custom_difficulty, original_recipe_details.difficulty),
            COALESCE(template_recipe_entry.custom_instructions, original_recipe_details.instructions)
        )
        RETURNING id INTO new_diet_plan_recipe_id;

        -- Copiar los ingredientes a diet_plan_recipe_ingredients
        IF (SELECT EXISTS (SELECT 1 FROM diet_plan_recipe_ingredients WHERE diet_plan_recipe_id = template_recipe_entry.id)) THEN
             FOR ingredient IN SELECT * FROM public.diet_plan_recipe_ingredients WHERE diet_plan_recipe_id = template_recipe_entry.id LOOP
                INSERT INTO public.diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
                VALUES (new_diet_plan_recipe_id, ingredient.food_id, ingredient.grams);
            END LOOP;
        ELSE
            FOR ingredient IN SELECT * FROM public.recipe_ingredients WHERE recipe_id = template_recipe_entry.recipe_id LOOP
                INSERT INTO public.diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
                VALUES (new_diet_plan_recipe_id, ingredient.food_id, ingredient.grams);
            END LOOP;
        END IF;

        -- Copiar los macros
        -- Primero intenta desde la instancia de receta del plan, luego desde la receta maestra
        SELECT * INTO macros FROM public.recipe_macros WHERE diet_plan_recipe_id = template_recipe_entry.id;
        IF NOT FOUND THEN
          SELECT * INTO macros FROM public.recipe_macros WHERE recipe_id = template_recipe_entry.recipe_id;
        END IF;

        IF FOUND THEN
            INSERT INTO public.recipe_macros (diet_plan_recipe_id, recipe_id, calories, proteins, carbs, fats)
            VALUES (new_diet_plan_recipe_id, NULL, macros.calories, macros.proteins, macros.carbs, macros.fats);
        END IF;

    END LOOP;

    RETURN new_plan_id;
END;
$$;


ALTER FUNCTION "public"."clone_diet_plan_template"("p_template_id" bigint, "p_client_id" "uuid", "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clone_diet_plan_template"("p_client_id" "uuid", "p_template_id" bigint, "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_plan_id bigint;
  template_recipe_entry record;
  original_recipe_details record;
  new_diet_plan_recipe_id bigint;
  ingredient record;
  macros record;
begin
  -- 1. Crear el nuevo plan de dieta para el cliente
  insert into public.diet_plans (
    user_id, name, start_date, end_date,
    protein_pct, carbs_pct, fat_pct,
    is_active, is_template, source_template_id
  )
  select
    p_client_id,
    p_new_plan_name,
    p_new_start_date,
    p_new_end_date,
    protein_pct,
    carbs_pct,
    fat_pct,
    true,
    false,
    p_template_id
  from public.diet_plans
  where id = p_template_id
    and is_template = true
  returning id into new_plan_id;

  if new_plan_id is null then
    raise exception 'No se pudo crear el nuevo plan de dieta a partir de la plantilla.';
  end if;

  -- 2. Recorrer las recetas de la plantilla y crear copias personalizadas para el nuevo plan
  for template_recipe_entry in
    select * from public.diet_plan_recipes where diet_plan_id = p_template_id
  loop
    -- Obtener los detalles de la receta maestra original
    select * into original_recipe_details
    from public.recipes
    where id = template_recipe_entry.recipe_id;

    -- Insertar la nueva instancia de receta en diet_plan_recipes
    insert into public.diet_plan_recipes (
      diet_plan_id,
      recipe_id,
      day_of_week,
      day_meal_id,
      is_customized,
      custom_name,
      custom_prep_time_min,
      custom_difficulty,
      custom_instructions
    )
    values (
      new_plan_id,
      template_recipe_entry.recipe_id,
      template_recipe_entry.day_of_week,
      template_recipe_entry.day_meal_id,
      true,
      coalesce(template_recipe_entry.custom_name, original_recipe_details.name),
      coalesce(template_recipe_entry.custom_prep_time_min, original_recipe_details.prep_time_min),
      coalesce(template_recipe_entry.custom_difficulty, original_recipe_details.difficulty),
      coalesce(template_recipe_entry.custom_instructions, original_recipe_details.instructions)
    )
    returning id into new_diet_plan_recipe_id;

    -- Copiar los ingredientes a diet_plan_recipe_ingredients
    if exists (
      select 1
      from public.diet_plan_recipe_ingredients
      where diet_plan_recipe_id = template_recipe_entry.id
    ) then
      for ingredient in
        select * from public.diet_plan_recipe_ingredients
        where diet_plan_recipe_id = template_recipe_entry.id
      loop
        insert into public.diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
        values (new_diet_plan_recipe_id, ingredient.food_id, ingredient.grams);
      end loop;
    else
      for ingredient in
        select * from public.recipe_ingredients
        where recipe_id = template_recipe_entry.recipe_id
      loop
        insert into public.diet_plan_recipe_ingredients (diet_plan_recipe_id, food_id, grams)
        values (new_diet_plan_recipe_id, ingredient.food_id, ingredient.grams);
      end loop;
    end if;

    -- Copiar los macros
    select * into macros
    from public.recipe_macros
    where diet_plan_recipe_id = template_recipe_entry.id;

    if not found then
      select * into macros
      from public.recipe_macros
      where recipe_id = template_recipe_entry.recipe_id;
    end if;

    if found then
      insert into public.recipe_macros (diet_plan_recipe_id, recipe_id, calories, proteins, carbs, fats)
      values (new_diet_plan_recipe_id, null, macros.calories, macros.proteins, macros.carbs, macros.fats);
    end if;

  end loop;

  return new_plan_id;
end;
$$;


ALTER FUNCTION "public"."clone_diet_plan_template"("p_client_id" "uuid", "p_template_id" bigint, "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clone_diet_plan_with_restrictions"("template_id" bigint, "client_id" "uuid", "new_plan_name" "text", "new_start_date" "date", "new_end_date" "date") RETURNS bigint
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
    user_restricted_food_ids bigint[];
    recipe_pathology_ids bigint[];
    recipe_food_ids bigint[];
    has_conflict boolean;
BEGIN
    SELECT array_agg(day_meal_id) INTO user_meal_ids FROM public.user_day_meals WHERE user_id = client_id;
    SELECT array_agg(pathology_id) INTO user_pathology_ids FROM public.user_pathologies WHERE user_id = client_id;
    SELECT array_agg(food_id) INTO user_restricted_food_ids FROM public.user_individual_food_restrictions WHERE user_id = client_id;

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

        IF NOT has_conflict AND user_restricted_food_ids IS NOT NULL THEN
            SELECT array_agg(food_id) INTO recipe_food_ids FROM public.recipe_ingredients WHERE recipe_id = template_recipe.recipe_id;
            IF recipe_food_ids IS NOT NULL THEN
                SELECT EXISTS (
                    SELECT 1 FROM unnest(user_restricted_food_ids) u_food_id
                    JOIN unnest(recipe_food_ids) r_food_id ON u_food_id = r_food_id
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


CREATE OR REPLACE FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_user_id uuid;
        v_diet_plan_id bigint;
        v_day_meal_id bigint;
        new_private_recipe_id bigint;
        occurrence_record record;
        ingredient_record jsonb;
        is_coach boolean;
        is_admin_user boolean;
    BEGIN
        -- Check permissions
        is_admin_user := is_admin();
        is_coach := EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.role = 'coach'
        );

        -- 1. Get info from the original free recipe
        SELECT user_id, diet_plan_id, day_meal_id
        INTO v_user_id, v_diet_plan_id, v_day_meal_id
        FROM free_recipes
        WHERE id = p_free_recipe_id;
        
        IF v_user_id IS NULL THEN
            RAISE EXCEPTION 'Free recipe not found';
        END IF;

        -- 2. Verify coach access if not admin
        IF NOT is_admin_user THEN
            IF is_coach THEN
                IF NOT EXISTS (SELECT 1 FROM coach_clients WHERE coach_id = auth.uid() AND client_id = v_user_id) THEN
                    RAISE EXCEPTION 'Permission denied: Client is not assigned to you.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Only admins or assigned coaches can perform this action';
            END IF;
        END IF;

        -- 3. Create the new private recipe
        INSERT INTO private_recipes (
            user_id,
            name,
            instructions,
            prep_time_min,
            difficulty,
            diet_plan_id,
            day_meal_id
        )
        VALUES (
            v_user_id,
            p_new_recipe_data->>'name',
            p_new_recipe_data->>'instructions',
            (p_new_recipe_data->>'prep_time_min')::integer,
            p_new_recipe_data->>'difficulty',
            v_diet_plan_id,
            v_day_meal_id
        )
        RETURNING id INTO new_private_recipe_id;

        -- 4. Insert ingredients for the new private recipe
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_new_ingredients)
        LOOP
            INSERT INTO private_recipe_ingredients (private_recipe_id, food_id, grams)
            VALUES (
                new_private_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'grams')::numeric
            );
        END LOOP;

        -- 5. Find all occurrences and update daily_meal_logs
        FOR occurrence_record IN
            SELECT id FROM free_recipe_occurrences WHERE free_recipe_id = p_free_recipe_id
        LOOP
            UPDATE daily_meal_logs
            SET 
                private_recipe_id = new_private_recipe_id,
                free_recipe_occurrence_id = NULL
            WHERE free_recipe_occurrence_id = occurrence_record.id;
        END LOOP;

        -- 6. Migrate equivalence adjustments
        UPDATE equivalence_adjustments
        SET 
            source_private_recipe_id = new_private_recipe_id,
            source_free_recipe_id = NULL
        WHERE source_free_recipe_id = p_free_recipe_id;

        -- 7. Clean up the original free recipe and its components
        DELETE FROM free_recipe_occurrences WHERE free_recipe_id = p_free_recipe_id;
        DELETE FROM free_recipe_ingredients WHERE free_recipe_id = p_free_recipe_id;
        DELETE FROM free_recipes WHERE id = p_free_recipe_id;

        RETURN new_private_recipe_id;
    END;
$$;


ALTER FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_diet_change_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  recipe_name text;
  notification_message text;
  approval_type text;
begin
  -- Determine the name of the recipe involved in the change request
  if new.diet_plan_recipe_id is not null then
    select coalesce(dpr.custom_name, r.name, 'una receta')
      into recipe_name
    from public.diet_plan_recipes dpr
    left join public.recipes r on dpr.recipe_id = r.id
    where dpr.id = new.diet_plan_recipe_id;

  elsif new.private_recipe_id is not null then
    select pr.name
      into recipe_name
    from public.private_recipes pr
    where pr.id = new.private_recipe_id;

  else
    recipe_name := 'una receta';
  end if;

  -- Ensure recipe_name is not null
  recipe_name := coalesce(recipe_name, 'una receta');

  -- Create the notification message if the status changes from 'pending'
  if old.status = 'pending' and (new.status = 'approved' or new.status = 'rejected') then

    if new.status = 'rejected' then
      notification_message := 'Tu solicitud para la receta "' || recipe_name || '" ha sido rechazada.';
    else
      approval_type := new.admin_comment; -- 'replace' or 'save_copy'

      if approval_type = 'replace' then
        notification_message := 'Tu solicitud para la receta "' || recipe_name || '" ha sido aprobada. La receta original ha sido reemplazada por la nueva versión.';
      elsif approval_type = 'save_copy' then
        notification_message := 'Tu solicitud para la receta "' || recipe_name || '" ha sido aprobada. Se ha guardado una nueva copia de la receta en tu plan.';
      else
        notification_message := 'Tu solicitud para la receta "' || recipe_name || '" ha sido aprobada.';
      end if;
    end if;

    insert into public.user_notifications (user_id, title, message, type, is_read)
    values (
      new.user_id,
      'Solicitud de cambio revisada',
      notification_message,
      'diet_change_status',
      false
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_diet_change_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_private_recipe_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.user_notifications (user_id, title, message, type)
  values (
    new.user_id,
    '¡Receta Guardada!',
    '¡Tu receta libre "' || new.name || '" ha sido tan buena que ha sido guardada en tu plan para que la disfrutes cuando quieras!',
    'free_recipe_saved'
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."create_private_recipe_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    child_id bigint;
BEGIN
    -- Ensure the caller is an admin or the owner (though owner checks usually happen in RLS/policies, 
    -- explicit function permission checks are good practice if this function is SECURITY DEFINER)
    IF NOT is_admin() THEN
        -- You might want to allow users to delete their own, but for now let's assume Admin context or
        -- rely on RLS if we weren't using SECURITY DEFINER. Since it's SECURITY DEFINER, we must be careful.
        -- However, based on context, this is primarily used in Admin/Planner views.
        -- Let's proceed assuming the frontend handles auth checks or we trust the admin role check.
        NULL; 
    END IF;

    -- 1. Recursively find and delete children first (to respect FK parent_diet_plan_recipe_id)
    -- This handles the "Key is still referenced from table diet_plan_recipes" error
    FOR child_id IN SELECT id FROM diet_plan_recipes WHERE parent_diet_plan_recipe_id = p_recipe_id LOOP
        PERFORM delete_diet_plan_recipe_with_dependencies(child_id);
    END LOOP;

    -- 2. Delete direct dependencies for this specific recipe ID
    
    -- diet_change_requests (linked either via diet_plan_recipe_id or potentially private_recipe_id if converted, 
    -- but here we focus on diet_plan_recipe_id)
    DELETE FROM diet_change_requests 
    WHERE diet_plan_recipe_id = p_recipe_id;

    -- daily_meal_logs
    DELETE FROM daily_meal_logs 
    WHERE diet_plan_recipe_id = p_recipe_id;
    
    -- planned_meals
    DELETE FROM planned_meals 
    WHERE diet_plan_recipe_id = p_recipe_id;

    -- daily_ingredient_adjustments (linked via diet_plan_recipe_id)
    DELETE FROM daily_ingredient_adjustments 
    WHERE diet_plan_recipe_id = p_recipe_id;

    -- recipe_macros (linked via diet_plan_recipe_id)
    DELETE FROM recipe_macros
    WHERE diet_plan_recipe_id = p_recipe_id;
    
    -- diet_plan_recipe_ingredients (ingredients specific to this plan recipe instance)
    DELETE FROM diet_plan_recipe_ingredients
    WHERE diet_plan_recipe_id = p_recipe_id;

    -- equivalence_adjustments (via dependent daily_ingredient_adjustments - though we deleted those above,
    -- sometimes equivalence_adjustments point to source_diet_plan_recipe_id if that column exists and is used.
    -- Based on schema: source_diet_plan_recipe_id exists in equivalence_adjustments)
    DELETE FROM equivalence_adjustments
    WHERE source_diet_plan_recipe_id = p_recipe_id;

    -- 3. Finally, delete the diet_plan_recipe itself
    DELETE FROM diet_plan_recipes WHERE id = p_recipe_id;
END;
$$;


ALTER FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_diet_plan_with_dependencies"("p_plan_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    recipe_ids bigint[];
    user_day_meal_ids bigint[];
    equivalence_ids bigint[];
    snack_log_ids bigint[];
BEGIN
    -- 1. Identify all related IDs for the plan
    SELECT array_agg(id) INTO recipe_ids FROM diet_plan_recipes WHERE diet_plan_id = p_plan_id;
    SELECT array_agg(id) INTO user_day_meal_ids FROM user_day_meals WHERE diet_plan_id = p_plan_id;

    -- 2. Handle Equivalence Adjustments & Daily Ingredient Adjustments
    -- Need to find equivalences linked to the plan via target meals OR source recipes
    -- Also need to handle equivalences linked to snack logs that are linked to the plan's meals
    
    -- Find snack logs linked to this plan's meals (to find dependent equivalences)
    IF user_day_meal_ids IS NOT NULL THEN
        SELECT array_agg(id) INTO snack_log_ids FROM daily_snack_logs WHERE user_day_meal_id = ANY(user_day_meal_ids);
    END IF;

    SELECT array_agg(id) INTO equivalence_ids 
    FROM equivalence_adjustments 
    WHERE (target_user_day_meal_id = ANY(user_day_meal_ids))
       OR (source_diet_plan_recipe_id = ANY(recipe_ids))
       OR (source_daily_snack_log_id = ANY(snack_log_ids));

    -- 2a. Delete Daily Ingredient Adjustments (depend on equivalences OR recipes)
    IF equivalence_ids IS NOT NULL THEN
        DELETE FROM daily_ingredient_adjustments WHERE equivalence_adjustment_id = ANY(equivalence_ids);
    END IF;
    
    IF recipe_ids IS NOT NULL THEN
        DELETE FROM daily_ingredient_adjustments WHERE diet_plan_recipe_id = ANY(recipe_ids);
    END IF;

    -- 2b. Delete Equivalence Adjustments
    IF equivalence_ids IS NOT NULL THEN
        DELETE FROM equivalence_adjustments WHERE id = ANY(equivalence_ids);
    END IF;

    -- 3. Delete Logs (depend on user_day_meals and recipes)
    IF user_day_meal_ids IS NOT NULL THEN
        DELETE FROM daily_snack_logs WHERE user_day_meal_id = ANY(user_day_meal_ids);
        DELETE FROM daily_meal_logs WHERE user_day_meal_id = ANY(user_day_meal_ids);
    END IF;
    
    IF recipe_ids IS NOT NULL THEN
        -- Cleanup logs that might reference recipes but somehow not the meal (orphan data safety)
        DELETE FROM daily_meal_logs WHERE diet_plan_recipe_id = ANY(recipe_ids);
    END IF;

    -- 4. Delete User Day Meals (depend on diet_plan)
    IF user_day_meal_ids IS NOT NULL THEN
        DELETE FROM user_day_meals WHERE id = ANY(user_day_meal_ids);
    END IF;

    -- 5. Delete Recipe Dependencies
    IF recipe_ids IS NOT NULL THEN
        DELETE FROM planned_meals WHERE diet_plan_recipe_id = ANY(recipe_ids);
        DELETE FROM diet_plan_recipe_ingredients WHERE diet_plan_recipe_id = ANY(recipe_ids);
        DELETE FROM recipe_macros WHERE diet_plan_recipe_id = ANY(recipe_ids);
        DELETE FROM diet_change_requests WHERE diet_plan_recipe_id = ANY(recipe_ids);
        
        -- Break self-references before deletion
        UPDATE diet_plan_recipes SET parent_diet_plan_recipe_id = NULL WHERE diet_plan_id = p_plan_id;
    END IF;

    -- 6. Delete Plan Dependencies
    DELETE FROM planned_meals WHERE diet_plan_id = p_plan_id;
    DELETE FROM shopping_list_items WHERE plan_id = p_plan_id;
    DELETE FROM diet_plan_calorie_overrides WHERE diet_plan_id = p_plan_id;
    DELETE FROM diet_plan_medical_conditions WHERE diet_plan_id = p_plan_id;
    DELETE FROM diet_plan_sensitivities WHERE diet_plan_id = p_plan_id;
    DELETE FROM diet_plan_centers WHERE diet_plan_id = p_plan_id;

    -- 7. Unlink Loosely Coupled Items
    UPDATE snacks SET diet_plan_id = NULL WHERE diet_plan_id = p_plan_id;
    UPDATE free_recipes SET diet_plan_id = NULL WHERE diet_plan_id = p_plan_id;
    UPDATE private_recipes SET diet_plan_id = NULL WHERE diet_plan_id = p_plan_id;
    UPDATE diet_plans SET source_template_id = NULL WHERE source_template_id = p_plan_id;

    -- 8. Delete Recipes and Plan
    DELETE FROM diet_plan_recipes WHERE diet_plan_id = p_plan_id;
    DELETE FROM diet_plans WHERE id = p_plan_id;
END;
$$;


ALTER FUNCTION "public"."delete_diet_plan_with_dependencies"("p_plan_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Check if user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can delete food items.';
    END IF;

    -- Delete dependencies in related tables
    DELETE FROM food_to_food_groups WHERE food_id = p_food_id;
    DELETE FROM food_to_macro_roles WHERE food_id = p_food_id;
    DELETE FROM food_to_seasons WHERE food_id = p_food_id;
    DELETE FROM food_to_stores WHERE food_id = p_food_id;
    DELETE FROM food_sensitivities WHERE food_id = p_food_id;
    DELETE FROM food_medical_conditions WHERE food_id = p_food_id;
    DELETE FROM food_antioxidants WHERE food_id = p_food_id;
    DELETE FROM food_vitamins WHERE food_id = p_food_id;
    DELETE FROM food_minerals WHERE food_id = p_food_id;
    DELETE FROM food_aminograms WHERE food_id = p_food_id;
    DELETE FROM food_aminogram_properties WHERE food_id = p_food_id;
    DELETE FROM food_fats WHERE food_id = p_food_id;
    DELETE FROM food_to_carb_subtypes WHERE food_id = p_food_id;
    DELETE FROM food_carbs WHERE food_id = p_food_id;
    DELETE FROM food_fat_classification WHERE food_id = p_food_id;
    DELETE FROM food_carb_classification WHERE food_id = p_food_id;
    DELETE FROM recipe_ingredients WHERE food_id = p_food_id;
    DELETE FROM diet_plan_recipe_ingredients WHERE food_id = p_food_id;
    DELETE FROM daily_ingredient_adjustments WHERE food_id = p_food_id;
    DELETE FROM shopping_list_items WHERE food_id = p_food_id;
    DELETE FROM snack_ingredients WHERE food_id = p_food_id;
    DELETE FROM free_recipe_ingredients WHERE food_id = p_food_id;
    DELETE FROM private_recipe_ingredients WHERE food_id = p_food_id;
    DELETE FROM user_individual_food_restrictions WHERE food_id = p_food_id;
    DELETE FROM preferred_foods WHERE food_id = p_food_id;
    DELETE FROM non_preferred_foods WHERE food_id = p_food_id;
    
    -- Unlink from user_created_foods
    UPDATE user_created_foods SET linked_food_id = NULL WHERE linked_food_id = p_food_id;

    -- Finally, delete the food item itself
    DELETE FROM food WHERE id = p_food_id;
END;
$$;


ALTER FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_user_id uuid;
        is_coach boolean;
        is_admin_user boolean;
    BEGIN
        -- Get the user_id from the free_recipe to check ownership
        SELECT user_id INTO v_user_id FROM free_recipes WHERE id = p_free_recipe_id;

        IF v_user_id IS NULL THEN
             RAISE EXCEPTION 'Free recipe not found';
        END IF;

        is_admin_user := is_admin();
        is_coach := EXISTS (
            SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() AND r.role = 'coach'
        );

        -- Check permissions
        IF auth.uid() != v_user_id AND NOT is_admin_user THEN
             IF is_coach THEN
                IF NOT EXISTS (SELECT 1 FROM coach_clients WHERE coach_id = auth.uid() AND client_id = v_user_id) THEN
                    RAISE EXCEPTION 'Permission denied to delete this free recipe. Client not assigned.';
                END IF;
             ELSE
                RAISE EXCEPTION 'Permission denied to delete this free recipe.';
             END IF;
        END IF;

        -- Delete from equivalence_adjustments linked to the free recipe
        DELETE FROM equivalence_adjustments
        WHERE source_free_recipe_id = p_free_recipe_id;

        -- Delete from daily_meal_logs
        DELETE FROM daily_meal_logs
        WHERE free_recipe_occurrence_id IN (
            SELECT id FROM free_recipe_occurrences WHERE free_recipe_id = p_free_recipe_id
        );

        -- Delete from free_recipe_occurrences
        DELETE FROM free_recipe_occurrences
        WHERE free_recipe_id = p_free_recipe_id;

        -- Delete from free_recipe_ingredients
        DELETE FROM free_recipe_ingredients
        WHERE free_recipe_id = p_free_recipe_id;

        -- Finally, delete the free_recipe itself
        DELETE FROM free_recipes
        WHERE id = p_free_recipe_id;
    END;
$$;


ALTER FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    child_id bigint;
BEGIN
    -- 1. Recursively find and delete children first (to respect FK parent_private_recipe_id)
    FOR child_id IN SELECT id FROM private_recipes WHERE parent_private_recipe_id = p_recipe_id LOOP
        PERFORM delete_private_recipe_cascade(child_id);
    END LOOP;

    -- 2. Delete direct dependencies
    
    -- diet_change_requests
    DELETE FROM diet_change_requests 
    WHERE private_recipe_id = p_recipe_id 
       OR requested_changes_private_recipe_id = p_recipe_id;

    -- private_recipe_ingredients
    DELETE FROM private_recipe_ingredients 
    WHERE private_recipe_id = p_recipe_id;

    -- daily_meal_logs
    DELETE FROM daily_meal_logs 
    WHERE private_recipe_id = p_recipe_id;
    
    -- planned_meals
    DELETE FROM planned_meals 
    WHERE private_recipe_id = p_recipe_id;

    -- daily_ingredient_adjustments (referencing this recipe directly)
    DELETE FROM daily_ingredient_adjustments 
    WHERE private_recipe_id = p_recipe_id;

    -- equivalence_adjustments (and their dependent daily_ingredient_adjustments)
    -- First delete dependent daily_ingredient_adjustments
    DELETE FROM daily_ingredient_adjustments 
    WHERE equivalence_adjustment_id IN (
        SELECT id FROM equivalence_adjustments WHERE source_private_recipe_id = p_recipe_id
    );
    
    -- Then delete the equivalence_adjustments themselves
    DELETE FROM equivalence_adjustments 
    WHERE source_private_recipe_id = p_recipe_id;

    -- 3. Delete the recipe itself
    DELETE FROM private_recipes WHERE id = p_recipe_id;
END;
$$;


ALTER FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        occurrence_record record;
        log_record record;
    BEGIN
        -- Check if the current user is the owner or an admin
        IF NOT (EXISTS (SELECT 1 FROM snacks WHERE id = p_snack_id AND user_id = auth.uid()) OR is_admin()) THEN
            RAISE EXCEPTION 'Permission denied to delete this snack.';
        END IF;

        -- Loop through occurrences to delete related logs and adjustments
        FOR occurrence_record IN
            SELECT id FROM snack_occurrences WHERE snack_id = p_snack_id
        LOOP
            -- Loop through logs of each occurrence
            FOR log_record IN
                SELECT id FROM daily_snack_logs WHERE snack_occurrence_id = occurrence_record.id
            LOOP
                -- Delete from equivalence_adjustments first
                DELETE FROM equivalence_adjustments WHERE source_daily_snack_log_id = log_record.id;
            END LOOP;
            
            -- Now delete the logs for the occurrence
            DELETE FROM daily_snack_logs WHERE snack_occurrence_id = occurrence_record.id;
        END LOOP;

        -- Delete snack occurrences
        DELETE FROM snack_occurrences WHERE snack_id = p_snack_id;

        -- Delete snack ingredients
        DELETE FROM snack_ingredients WHERE snack_id = p_snack_id;

        -- Finally, delete the snack itself
        DELETE FROM snacks WHERE id = p_snack_id;
    END;
$$;


ALTER FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    plan_record RECORD;
BEGIN
    -- Check if the caller is an admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can delete users.';
    END IF;

    -- 1. CRITICAL DEPENDENCIES: Equivalence Adjustments
    -- These link to profiles and other core tables. Must go first.
    
    -- Delete daily_ingredient_adjustments linked to user's equivalence adjustments
    DELETE FROM daily_ingredient_adjustments
    WHERE equivalence_adjustment_id IN (
        SELECT id FROM equivalence_adjustments WHERE user_id = p_user_id
    );

    -- Delete equivalence_adjustments
    DELETE FROM equivalence_adjustments WHERE user_id = p_user_id;

    -- 2. Diet Plans and their deep dependencies
    -- We use the helper function for each plan to ensure clean removal of recipes, ingredients, etc.
    FOR plan_record IN SELECT id FROM diet_plans WHERE user_id = p_user_id LOOP
        PERFORM delete_diet_plan_with_dependencies(plan_record.id);
    END LOOP;

    -- 3. Logs, Snapshots, and History
    DELETE FROM daily_meal_logs WHERE user_id = p_user_id;
    DELETE FROM daily_snack_logs WHERE user_id = p_user_id;
    DELETE FROM daily_plan_snapshots WHERE user_id = p_user_id;
    DELETE FROM plan_adherence_logs WHERE user_id = p_user_id;
    DELETE FROM planned_meals WHERE user_id = p_user_id;
    DELETE FROM diet_change_requests WHERE user_id = p_user_id;

    -- 4. Independent Recipes, Snacks, and Foods
    -- Free Recipes
    DELETE FROM free_recipe_occurrences WHERE user_id = p_user_id;
    DELETE FROM free_recipe_ingredients WHERE free_recipe_id IN (SELECT id FROM free_recipes WHERE user_id = p_user_id);
    DELETE FROM free_recipes WHERE user_id = p_user_id;

    -- Private Recipes
    DELETE FROM private_recipe_ingredients WHERE private_recipe_id IN (SELECT id FROM private_recipes WHERE user_id = p_user_id);
    DELETE FROM private_recipes WHERE user_id = p_user_id;

    -- Snacks
    DELETE FROM snack_occurrences WHERE user_id = p_user_id;
    DELETE FROM snack_ingredients WHERE snack_id IN (SELECT id FROM snacks WHERE user_id = p_user_id);
    DELETE FROM snacks WHERE user_id = p_user_id;

    -- User Created Foods
    DELETE FROM user_created_food_vitamins WHERE user_created_food_id IN (SELECT id FROM user_created_foods WHERE user_id = p_user_id);
    DELETE FROM user_created_food_minerals WHERE user_created_food_id IN (SELECT id FROM user_created_foods WHERE user_id = p_user_id);
    DELETE FROM user_created_food_sensitivities WHERE user_created_food_id IN (SELECT id FROM user_created_foods WHERE user_id = p_user_id);
    DELETE FROM user_created_food_to_food_groups WHERE user_created_food_id IN (SELECT id FROM user_created_foods WHERE user_id = p_user_id);
    DELETE FROM user_created_foods WHERE user_id = p_user_id;

    -- 5. User Preferences and Settings
    DELETE FROM user_day_meals WHERE user_id = p_user_id; -- Links to day_meals
    DELETE FROM shopping_list_items WHERE user_id = p_user_id;
    DELETE FROM private_shopping_list_items WHERE user_id = p_user_id;
    DELETE FROM weight_logs WHERE user_id = p_user_id;
    DELETE FROM diet_preferences WHERE user_id = p_user_id;
    DELETE FROM training_preferences WHERE user_id = p_user_id;
    DELETE FROM user_individual_food_restrictions WHERE user_id = p_user_id;
    DELETE FROM user_medical_conditions WHERE user_id = p_user_id;
    DELETE FROM user_sensitivities WHERE user_id = p_user_id;
    DELETE FROM preferred_foods WHERE user_id = p_user_id;
    DELETE FROM non_preferred_foods WHERE user_id = p_user_id;
    DELETE FROM user_utilities WHERE user_id = p_user_id;
    DELETE FROM user_notifications WHERE user_id = p_user_id;
    DELETE FROM advisories WHERE user_id = p_user_id;
    DELETE FROM reminders WHERE user_id = p_user_id;

    -- 6. Relationships and Roles
    DELETE FROM coach_clients WHERE client_id = p_user_id OR coach_id = p_user_id;
    DELETE FROM user_centers WHERE user_id = p_user_id;
    DELETE FROM user_roles WHERE user_id = p_user_id;
    
    -- Clean up references where user might be an admin/creator but not the owner of the record
    UPDATE diet_plan_centers SET assigned_by = NULL WHERE assigned_by = p_user_id;

    -- 7. Profile
    DELETE FROM profiles WHERE user_id = p_user_id;

    -- 8. Auth User
    DELETE FROM auth.users WHERE id = p_user_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error deleting user: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_food"("p_food_name" "text", "p_food_group" "text", "p_state" "text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
declare
  v_food_id int;
begin
  -- Buscar alimento existente (ignora plural/singular y mayúsculas)
  select id into v_food_id
  from public.food
  where lower(trim(both ' ' from food_name)) in (
    lower(trim(both ' ' from p_food_name)),
    lower(trim(both ' ' from regexp_replace(p_food_name, 's$', ''))),
    lower(trim(both ' ' from regexp_replace(p_food_name, 'es$', '')))
  )
  and lower(food_group) = lower(p_food_group)
  and lower(state) = lower(p_state)
  limit 1;

  -- Si no existe, se crea
  if v_food_id is null then
    insert into public.food (food_name, food_group, state)
    values (p_food_name, p_food_group, p_state)
    returning id into v_food_id;
  end if;

  return v_food_id;
end;
$_$;


ALTER FUNCTION "public"."get_or_create_food"("p_food_name" "text", "p_food_group" "text", "p_state" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_plan_items"("p_user_id" "uuid", "p_plan_id" bigint, "p_start_date" "date", "p_end_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'planRecipes', (
            SELECT COALESCE(jsonb_agg(dpr_agg), '[]'::jsonb)
            FROM (
                SELECT 
                    dpr.*,
                    r.name as recipe_name,
                    r.instructions as recipe_instructions,
                    r.prep_time_min as recipe_prep_time_min,
                    r.difficulty as recipe_difficulty,
                    (
                        SELECT jsonb_agg(jsonb_build_object('food_id', ri.food_id, 'grams', ri.grams))
                        FROM recipe_ingredients ri WHERE ri.recipe_id = dpr.recipe_id
                    ) as recipe_ingredients,
                    dm.name as day_meal_name
                FROM diet_plan_recipes dpr
                JOIN recipes r ON dpr.recipe_id = r.id
                JOIN day_meals dm ON dpr.day_meal_id = dm.id
                WHERE dpr.diet_plan_id = p_plan_id
            ) dpr_agg
        ),
        'privateRecipes', (
            SELECT COALESCE(jsonb_agg(pr_agg), '[]'::jsonb)
            FROM (
                SELECT pr.*
                FROM private_recipes pr
                WHERE pr.user_id = p_user_id AND pr.diet_plan_id = p_plan_id
            ) pr_agg
        ),
        'freeMeals', (
             SELECT COALESCE(jsonb_agg(fm_agg), '[]'::jsonb)
             FROM (
                SELECT 
                    fro.*,
                    fr.name,
                    fr.instructions,
                    fr.prep_time_min,
                    fr.difficulty,
                    fr.day_meal_id,
                    (
                        SELECT jsonb_agg(jsonb_build_object(
                            'food_id', fri.food_id, 
                            'user_created_food_id', fri.user_created_food_id,
                            'grams', fri.grams
                        ))
                        FROM free_recipe_ingredients fri
                        WHERE fri.free_recipe_id = fr.id
                    ) as free_recipe_ingredients,
                    fro.id as occurrence_id
                FROM free_recipe_occurrences fro
                JOIN free_recipes fr ON fro.free_recipe_id = fr.id
                WHERE fro.user_id = p_user_id 
                  AND (fr.diet_plan_id = p_plan_id OR fr.diet_plan_id IS NULL)
                  AND fro.meal_date BETWEEN p_start_date AND p_end_date
            ) fm_agg
        ),
        'mealLogs', (
            SELECT COALESCE(jsonb_agg(dml), '[]'::jsonb) FROM daily_meal_logs dml
            WHERE dml.user_id = p_user_id AND dml.log_date BETWEEN p_start_date AND p_end_date
        ),
        'userDayMeals', (
            SELECT COALESCE(jsonb_agg(udm_agg), '[]'::jsonb)
            FROM (
                SELECT udm.*, dm.name as day_meal_name, dm.display_order 
                FROM user_day_meals udm
                JOIN day_meals dm ON udm.day_meal_id = dm.id
                WHERE udm.user_id = p_user_id
                ORDER BY dm.display_order
            ) udm_agg
        ),
        'adjustments', (
            SELECT COALESCE(jsonb_agg(ea), '[]'::jsonb) FROM equivalence_adjustments ea
            WHERE ea.user_id = p_user_id AND ea.log_date BETWEEN p_start_date AND p_end_date
        ),
        'userRestrictions', (
            SELECT get_user_restrictions(p_user_id)
        ),
        'snacks', (
            SELECT COALESCE(jsonb_agg(s_agg), '[]'::jsonb)
            FROM (
                SELECT 
                    so.*,
                    s.name,
                    s.id as snack_id,
                    so.id as occurrence_id,
                    (SELECT jsonb_agg(si) FROM snack_ingredients si WHERE si.snack_id = so.snack_id) as snack_ingredients
                FROM snack_occurrences so
                JOIN snacks s ON so.snack_id = s.id
                WHERE so.user_id = p_user_id AND so.meal_date BETWEEN p_start_date AND p_end_date
            ) s_agg
        ),
        'snackLogs', (
            SELECT COALESCE(jsonb_agg(dsl), '[]'::jsonb) FROM daily_snack_logs dsl
            WHERE dsl.user_id = p_user_id AND dsl.log_date BETWEEN p_start_date AND p_end_date
        ),
        'dailyIngredientAdjustments', (
             SELECT COALESCE(jsonb_agg(dia_agg), '[]'::jsonb)
             FROM (
                SELECT dia.*, ea.log_date, ea.target_user_day_meal_id
                FROM daily_ingredient_adjustments dia
                JOIN equivalence_adjustments ea ON dia.equivalence_adjustment_id = ea.id
                WHERE ea.user_id = p_user_id AND ea.log_date BETWEEN p_start_date AND p_end_date
             ) dia_agg
        ),
        'equivalenceAdjustments', (
            SELECT COALESCE(jsonb_agg(ea), '[]'::jsonb) FROM equivalence_adjustments ea
            WHERE ea.user_id = p_user_id AND ea.log_date BETWEEN p_start_date AND p_end_date
        ),
        'allAvailableFoods', (
            SELECT COALESCE(jsonb_agg(all_foods), '[]'::jsonb)
            FROM (
                SELECT
                    f.id,
                    f.name,
                    f.food_type,
                    f.food_unit,
                    f.user_id,
                    f.proteins,
                    f.protein_source_id,
                    f.total_carbs,
                    f.total_fats,
                    f.food_url,
                    f.status,
                    f.grams_per_unit,
                    false as is_user_created,
                    COALESCE((
                        SELECT jsonb_agg(fs) 
                        FROM food_sensitivities fs 
                        WHERE fs.food_id = f.id
                    ), '[]'::jsonb) as food_sensitivities,
                    COALESCE((
                        SELECT jsonb_agg(fmc) 
                        FROM food_medical_conditions fmc 
                        WHERE fmc.food_id = f.id
                    ), '[]'::jsonb) as food_medical_conditions
                FROM food f
            ) all_foods
        ),
        'plannedMeals', (
            SELECT COALESCE(jsonb_agg(pm_details), '[]'::jsonb)
            FROM (
                SELECT 
                    pm.id,
                    pm.user_id,
                    pm.diet_plan_id,
                    pm.diet_plan_recipe_id,
                    pm.private_recipe_id,
                    pm.free_recipe_id,
                    pm.day_meal_id,
                    pm.plan_date,
                    pm.created_at,
                    (CASE 
                        WHEN pm.diet_plan_recipe_id IS NOT NULL THEN 
                            (SELECT to_jsonb(dpr) || jsonb_build_object(
                                'recipe', (SELECT to_jsonb(r) || jsonb_build_object(
                                    'recipe_ingredients', (SELECT jsonb_agg(ri) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id)
                                ) FROM recipes r WHERE r.id = dpr.recipe_id),
                                'custom_ingredients', (SELECT jsonb_agg(dpri) FROM diet_plan_recipe_ingredients dpri WHERE dpri.diet_plan_recipe_id = dpr.id)
                            ) FROM diet_plan_recipes dpr WHERE dpr.id = pm.diet_plan_recipe_id)
                        ELSE NULL
                    END) AS diet_plan_recipe,
                    (CASE 
                        WHEN pm.private_recipe_id IS NOT NULL THEN 
                            (SELECT to_jsonb(pr) || jsonb_build_object(
                                'private_recipe_ingredients', (SELECT jsonb_agg(pri) FROM private_recipe_ingredients pri WHERE pri.private_recipe_id = pr.id)
                            ) FROM private_recipes pr WHERE pr.id = pm.private_recipe_id)
                        ELSE NULL
                    END) AS private_recipe,
                    (CASE 
                        WHEN pm.free_recipe_id IS NOT NULL THEN 
                             (SELECT to_jsonb(fr) || jsonb_build_object(
                                'free_recipe_ingredients', (SELECT jsonb_agg(fri) FROM free_recipe_ingredients fri WHERE fri.free_recipe_id = fr.id)
                            ) FROM free_recipes fr WHERE fr.id = pm.free_recipe_id)
                        ELSE NULL
                    END) AS free_recipe
                FROM planned_meals pm
                WHERE pm.user_id = p_user_id 
                AND pm.plan_date BETWEEN p_start_date AND p_end_date
            ) pm_details
        )
    ) INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_plan_items"("p_user_id" "uuid", "p_plan_id" bigint, "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_plan_recipes_with_ingredients"("p_plan_id" bigint) RETURNS TABLE("recipe_id" bigint, "food_id" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
      dpr.recipe_id,
      ri.food_id
  FROM
      diet_plan_recipes dpr
  JOIN
      recipe_ingredients ri ON dpr.recipe_id = ri.recipe_id
  WHERE
      dpr.diet_plan_id = p_plan_id

  UNION

  SELECT
      dpr.recipe_id,
      dpri.food_id
  FROM
      diet_plan_recipes dpr
  JOIN
      diet_plan_recipe_ingredients dpri ON dpr.id = dpri.diet_plan_recipe_id
  WHERE
      dpr.diet_plan_id = p_plan_id;
END;
$$;


ALTER FUNCTION "public"."get_plan_recipes_with_ingredients"("p_plan_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  sensitivities_data jsonb;
  conditions_data jsonb;
  food_restrictions_data jsonb;
begin
  -- Get user sensitivities
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)), '[]'::jsonb)
    into sensitivities_data
  from public.user_sensitivities us
  join public.sensitivities s on us.sensitivity_id = s.id
  where us.user_id = p_user_id;

  -- Get user medical conditions
  select coalesce(jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name)), '[]'::jsonb)
    into conditions_data
  from public.user_medical_conditions umc
  join public.medical_conditions mc on umc.condition_id = mc.id
  where umc.user_id = p_user_id;

  -- Get user individual food restrictions
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name)), '[]'::jsonb)
    into food_restrictions_data
  from public.user_individual_food_restrictions uifr
  join public.food f on uifr.food_id = f.id
  where uifr.user_id = p_user_id;

  -- Combine all restrictions into a single JSONB object
  return jsonb_build_object(
    'sensitivities', sensitivities_data,
    'medical_conditions', conditions_data,
    'individual_food_restrictions', food_restrictions_data
  );
end;
$$;


ALTER FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_free_recipes_by_status"("_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated integer;
begin
  update public.private_recipe_ingredients t
  set grams = x.grams
  from jsonb_to_recordset(_rows) as x(id bigint, grams numeric)
  where t.id = x.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."get_users_with_free_recipes_by_status"("_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") RETURNS TABLE("user_id" "uuid", "full_name" "text", "pending_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    p.user_id,
    p.full_name,
    count(fr.id)::integer as pending_count
  from public.free_recipes fr
  join public.profiles p on fr.user_id = p.user_id
  where fr.status = p_status
  group by p.user_id, p.full_name
  having count(fr.id) > 0
  order by p.full_name;
end;
$$;


ALTER FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_pending_foods_count"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "pending_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    COUNT(ucf.id)::integer AS pending_count
  FROM
    public.user_created_foods ucf
  JOIN
    public.profiles p ON ucf.user_id = p.user_id
  WHERE
    ucf.status = 'pending'
  GROUP BY
    p.user_id, p.full_name
  HAVING
    COUNT(ucf.id) > 0
  ORDER BY
    p.full_name;
END;
$$;


ALTER FUNCTION "public"."get_users_with_pending_foods_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Create a profile for the new user, including the email from auth.users
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;

  -- Assign the default 'free' role to the new user
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (new.id, (SELECT id FROM public.roles WHERE role = 'free'))
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_coach"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND (r.role = 'admin' OR r.role = 'coach')
  );
END;
$$;


ALTER FUNCTION "public"."is_admin_or_coach"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."moddatetime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."moddatetime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nombre_de_tu_funcion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_supabase_url text;
    v_service_role_key text;
begin
    v_supabase_url := 'https://eglsbtetefqfwidpjtyf.supabase.co';
    v_service_role_key := 'SERVICE_ROLE_KEY_AQUI';

    perform net.http_post(
        url := v_supabase_url || '/functions/v1/auto-balance-macros',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
            'equivalence_adjustment_id', NEW.id
        )
    );

    return NEW;
end;
$$;


ALTER FUNCTION "public"."nombre_de_tu_funcion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_balance_macros"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
BEGIN
    -- Manually set your Supabase URL and Service Role Key here
    v_supabase_url := 'https://eglsbtetefqfwidpjtyf.supabase.co';
    v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbHNidGV0ZWZxZndpZHBqdHlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY3NjEwNSwiZXhwIjoyMDY2MjUyMTA1fQ.2iW2i6vBwWqN8O7nJjQj_a-3hKj2rfv1Yx4sL1g3xIY';

    PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/auto-balance-macros',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
            'equivalence_adjustment_id', NEW.id
        )
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_auto_balance_macros"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_balance_macros"("_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_updated integer;
begin
  update public.private_recipe_ingredients t
  set grams = x.grams
  from jsonb_to_recordset(_rows) as x(id bigint, grams numeric)
  where t.id = x.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;


ALTER FUNCTION "public"."trigger_auto_balance_macros"("_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_equivalence_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
begin
  perform net.http_post(
    url := 'https://eglsbtetefqfwidpjtyf.supabase.co/functions/v1/auto-balance-equivalence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'SUPABASE_SERVICE_ROLE_KEY'
        limit 1
      )
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."trigger_equivalence_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_food_total_carbs"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    food_record RECORD;
    carbs_sum NUMERIC;
    fiber_type_id BIGINT;
BEGIN
    -- Get the ID for 'Fibra' carb type
    SELECT id INTO fiber_type_id FROM public.carb_types WHERE name = 'Fibra' LIMIT 1;

    IF fiber_type_id IS NULL THEN
        RAISE NOTICE 'Carb type "Fibra" not found. Aborting update.';
        RETURN;
    END IF;

    -- Loop through all foods
    FOR food_record IN SELECT id FROM public.food LOOP
        -- Calculate sum of carbs for the current food, excluding fiber
        SELECT COALESCE(SUM(fc.grams), 0)
        INTO carbs_sum
        FROM public.food_carbs fc
        WHERE fc.food_id = food_record.id
          AND fc.carb_type_id != fiber_type_id;

        -- Update the total_carbs field in the food table
        UPDATE public.food
        SET total_carbs = carbs_sum
        WHERE id = food_record.id;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_all_food_total_carbs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_food_total_carbs"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  fiber_type_id bigint;
begin
  -- ID del tipo "Fibra"
  select id into fiber_type_id
  from public.carb_types
  where name = 'Fibra'
  limit 1;

  if fiber_type_id is null then
    raise notice 'No se encontró el tipo de carbohidrato "Fibra". No se realizarán actualizaciones.';
    return;
  end if;

  -- Un solo UPDATE: total_carbs = suma de carbs excluyendo fibra
  update public.food f
  set total_carbs = coalesce(x.carbs_sum, 0)
  from (
    select
      fcnd.food_id,
      sum(fcnd.grams_per_100g) as carbs_sum
    from public.food_carb_nutritional_data fcnd
    join public.carb_subtypes cs on fcnd.subtype_id = cs.id
    join public.carb_classification cc on cs.classification_id = cc.id
    where cc.carb_type_id != fiber_type_id
    group by fcnd.food_id
  ) x
  where x.food_id = f.id;

  -- Opcional: poner 0 a foods sin registros (si total_carbs puede quedar NULL)
  update public.food
  set total_carbs = 0
  where total_carbs is null;
end;
$$;


ALTER FUNCTION "public"."update_food_total_carbs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        ingredient_record jsonb;
    BEGIN
        -- 1. Update the free_recipes table
        UPDATE free_recipes
        SET
            name = p_name,
            instructions = p_instructions,
            prep_time_min = p_prep_time_min,
            difficulty = p_difficulty
        WHERE id = p_recipe_id;

        -- 2. Delete existing ingredients for this free recipe
        DELETE FROM free_recipe_ingredients
        WHERE free_recipe_id = p_recipe_id;

        -- 3. Insert the new ingredients
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO free_recipe_ingredients (free_recipe_id, food_id, user_created_food_id, grams, status)
            VALUES (
                p_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'user_created_food_id')::bigint,
                (ingredient_record->>'grams')::numeric,
                'approved'
            );
        END LOOP;
    END;
$$;


ALTER FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        ingredient_record jsonb;
    BEGIN
        -- 1. Update the private_recipes table
        UPDATE private_recipes
        SET
            name = p_name,
            instructions = p_instructions,
            prep_time_min = p_prep_time_min,
            difficulty = p_difficulty
        WHERE id = p_recipe_id;

        -- 2. Delete existing ingredients for this private recipe
        DELETE FROM private_recipe_ingredients
        WHERE private_recipe_id = p_recipe_id;

        -- 3. Insert the new ingredients
        FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            INSERT INTO private_recipe_ingredients (private_recipe_id, food_id, grams)
            VALUES (
                p_recipe_id,
                (ingredient_record->>'food_id')::bigint,
                (ingredient_record->>'grams')::numeric
            );
        END LOOP;
    END;
$$;


ALTER FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_current_weight"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    latest_weight NUMERIC;
    v_user_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    SELECT weight_kg INTO latest_weight
    FROM public.weight_logs
    WHERE user_id = v_user_id
    ORDER BY logged_on DESC, id DESC
    LIMIT 1;

    UPDATE public.profiles
    SET current_weight_kg = latest_weight
    WHERE user_id = v_user_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_profile_current_weight"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_levels" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "factor" numeric(4,3) NOT NULL
);


ALTER TABLE "public"."activity_levels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."activity_levels_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."activity_levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."activity_levels_id_seq" OWNED BY "public"."activity_levels"."id";



CREATE TABLE IF NOT EXISTS "public"."advisories" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_date" "date" NOT NULL,
    "item_type" "text",
    "item_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."advisories" OWNER TO "postgres";


ALTER TABLE "public"."advisories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."advisories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."aminograms" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "funcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "beneficios" "text",
    "deficiencias" "text"
);


ALTER TABLE "public"."aminograms" OWNER TO "postgres";


ALTER TABLE "public"."aminograms" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."aminograms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."antioxidants" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deficience" "text",
    "type" "text",
    "cofactor" boolean,
    "vitamin_id" bigint,
    "mineral_id" bigint
);


ALTER TABLE "public"."antioxidants" OWNER TO "postgres";


ALTER TABLE "public"."antioxidants" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."antioxidants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."assignment_progress" (
    "user_id" "uuid" NOT NULL,
    "current_step" integer DEFAULT 2,
    "tour_shown" boolean DEFAULT true,
    "tour_accepted" boolean DEFAULT false,
    "plan_data" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."assignment_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carb_classification" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "carb_type_id" bigint
);


ALTER TABLE "public"."carb_classification" OWNER TO "postgres";


COMMENT ON TABLE "public"."carb_classification" IS 'Nivel 1: Clasificación general de los hidratos de carbono (Simples, Complejos, etc.).';



ALTER TABLE "public"."carb_classification" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."carb_classification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."carb_subtypes" (
    "id" bigint NOT NULL,
    "classification_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."carb_subtypes" OWNER TO "postgres";


COMMENT ON TABLE "public"."carb_subtypes" IS 'Nivel 2: Subtipos químicos de hidratos (Monosacáridos, Polisacáridos, etc.).';



ALTER TABLE "public"."carb_subtypes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."carb_subtypes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."carb_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."carb_types" OWNER TO "postgres";


ALTER TABLE "public"."carb_types" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."carb_types_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."centers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "center_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."centers" OWNER TO "postgres";


ALTER TABLE "public"."centers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."centers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."coach_clients" (
    "id" bigint NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."coach_clients" OWNER TO "postgres";


ALTER TABLE "public"."coach_clients" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."coach_clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_ingredient_adjustments" (
    "id" bigint NOT NULL,
    "equivalence_adjustment_id" bigint NOT NULL,
    "diet_plan_recipe_id" bigint,
    "private_recipe_id" bigint,
    "food_id" bigint NOT NULL,
    "original_grams" numeric NOT NULL,
    "adjusted_grams" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."daily_ingredient_adjustments" OWNER TO "postgres";


ALTER TABLE "public"."daily_ingredient_adjustments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."daily_ingredient_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_meal_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "diet_plan_recipe_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_day_meal_id" bigint,
    "private_recipe_id" bigint,
    "free_recipe_occurrence_id" bigint
);


ALTER TABLE "public"."daily_meal_logs" OWNER TO "postgres";


ALTER TABLE "public"."daily_meal_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_meal_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_plan_snapshots" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "plan_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_plan_snapshots" OWNER TO "postgres";


ALTER TABLE "public"."daily_plan_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_plan_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_snack_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "snack_occurrence_id" bigint NOT NULL,
    "user_day_meal_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_snack_logs" OWNER TO "postgres";


ALTER TABLE "public"."daily_snack_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_snack_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."day_meals" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer NOT NULL,
    "description" "text",
    "workout_day" boolean
);


ALTER TABLE "public"."day_meals" OWNER TO "postgres";


ALTER TABLE "public"."day_meals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."day_meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."diet_change_requests" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "diet_plan_recipe_id" bigint,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_comment" "text",
    "request_type" "text" DEFAULT 'replace'::"text" NOT NULL,
    "private_recipe_id" bigint,
    "requested_changes_private_recipe_id" bigint,
    CONSTRAINT "check_one_recipe_id" CHECK (((("diet_plan_recipe_id" IS NOT NULL) AND ("private_recipe_id" IS NULL)) OR (("diet_plan_recipe_id" IS NULL) AND ("private_recipe_id" IS NOT NULL)))),
    CONSTRAINT "chk_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."diet_change_requests" OWNER TO "postgres";


ALTER TABLE "public"."diet_change_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."diet_change_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."diet_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."diet_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diet_plan_calorie_overrides" (
    "id" bigint NOT NULL,
    "diet_plan_id" bigint,
    "manual_calories" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."diet_plan_calorie_overrides" OWNER TO "postgres";


ALTER TABLE "public"."diet_plan_calorie_overrides" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."diet_plan_calorie_overrides_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."diet_plan_centers" (
    "diet_plan_id" bigint NOT NULL,
    "center_id" bigint NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."diet_plan_centers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diet_plan_medical_conditions" (
    "diet_plan_id" bigint NOT NULL,
    "condition_id" bigint NOT NULL
);


ALTER TABLE "public"."diet_plan_medical_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diet_plan_recipe_ingredients" (
    "id" bigint NOT NULL,
    "diet_plan_recipe_id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "grams" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."diet_plan_recipe_ingredients" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."diet_plan_recipe_ingredients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."diet_plan_recipe_ingredients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."diet_plan_recipe_ingredients_id_seq" OWNED BY "public"."diet_plan_recipe_ingredients"."id";



CREATE TABLE IF NOT EXISTS "public"."diet_plan_recipes" (
    "id" bigint NOT NULL,
    "diet_plan_id" bigint NOT NULL,
    "recipe_id" bigint,
    "day_of_week" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_customized" boolean DEFAULT false,
    "custom_name" "text",
    "custom_prep_time_min" integer,
    "custom_difficulty" "text",
    "custom_instructions" "text",
    "custom_ingredients" "jsonb",
    "day_meal_id" bigint,
    "parent_diet_plan_recipe_id" bigint,
    CONSTRAINT "diet_plan_recipes_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 7)))
);


ALTER TABLE "public"."diet_plan_recipes" OWNER TO "postgres";


ALTER TABLE "public"."diet_plan_recipes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."diet_plan_recipes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."diet_plan_sensitivities" (
    "diet_plan_id" bigint NOT NULL,
    "sensitivity_id" bigint NOT NULL,
    "level" "text" DEFAULT 'Leve'::"text"
);


ALTER TABLE "public"."diet_plan_sensitivities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diet_plans" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "created_at" "date" DEFAULT CURRENT_DATE,
    "name" "text",
    "start_date" "date",
    "end_date" "date",
    "protein_pct" integer DEFAULT 30,
    "carbs_pct" integer DEFAULT 40,
    "fat_pct" integer DEFAULT 30,
    "is_active" boolean DEFAULT false,
    "is_template" boolean DEFAULT false NOT NULL,
    "source_template_id" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "classification_objective" "text"[],
    "classification_condition" "text"[],
    "classification_lifestyle" "text"[],
    "classification_nutrition_style" "text"[],
    "center_id" bigint,
    "template_scope" "text" DEFAULT 'center'::"text",
    "created_by" "uuid",
    CONSTRAINT "diet_plans_template_scope_check" CHECK (("template_scope" = ANY (ARRAY['global'::"text", 'center'::"text"])))
);


ALTER TABLE "public"."diet_plans" OWNER TO "postgres";


COMMENT ON COLUMN "public"."diet_plans"."protein_pct" IS 'Porcentaje de proteínas sobre el total de kcal diarias.';



COMMENT ON COLUMN "public"."diet_plans"."carbs_pct" IS 'Porcentaje de carbohidratos sobre el total de kcal diarias.';



COMMENT ON COLUMN "public"."diet_plans"."fat_pct" IS 'Porcentaje de grasas sobre el total de kcal diarias.';



CREATE SEQUENCE IF NOT EXISTS "public"."diet_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."diet_plans_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."diet_plans_id_seq" OWNED BY "public"."diet_plans"."id";



CREATE TABLE IF NOT EXISTS "public"."diet_preferences" (
    "user_id" "uuid" NOT NULL,
    "diet_history" "text",
    "meal_preferences" "text",
    "lives_alone" boolean,
    "eats_out" boolean,
    "likes_cooking" boolean,
    "diet_type_id" bigint,
    "diet_goal_id" "uuid"
);


ALTER TABLE "public"."diet_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diet_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."diet_types" OWNER TO "postgres";


ALTER TABLE "public"."diet_types" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."diet_types_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" bigint NOT NULL,
    "name" "text",
    "progression" "text"
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."equipment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."equipment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."equipment_id_seq" OWNED BY "public"."equipment"."id";



CREATE TABLE IF NOT EXISTS "public"."equivalence_adjustments" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "target_user_day_meal_id" bigint NOT NULL,
    "adjustment_calories" numeric NOT NULL,
    "adjustment_proteins" numeric NOT NULL,
    "adjustment_carbs" numeric NOT NULL,
    "adjustment_fats" numeric NOT NULL,
    "source_free_recipe_id" bigint,
    "source_daily_snack_log_id" bigint,
    "source_diet_plan_recipe_id" bigint,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "error_message" "text",
    "source_private_recipe_id" bigint,
    "source_free_recipe_occurrence_id" bigint
);


ALTER TABLE "public"."equivalence_adjustments" OWNER TO "postgres";


ALTER TABLE "public"."equivalence_adjustments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."equivalence_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."exercise_joints" (
    "exercise_id" bigint NOT NULL,
    "joint_id" bigint NOT NULL
);


ALTER TABLE "public"."exercise_joints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_muscles" (
    "exercise_id" bigint NOT NULL,
    "muscle_id" bigint NOT NULL
);


ALTER TABLE "public"."exercise_muscles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_sets" (
    "id" bigint NOT NULL,
    "workout_exercise_id" bigint,
    "set_no" integer,
    "reps" integer,
    "weight" integer,
    "rir" integer
);


ALTER TABLE "public"."exercise_sets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exercise_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exercise_sets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exercise_sets_id_seq" OWNED BY "public"."exercise_sets"."id";



CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" bigint NOT NULL,
    "name" "text",
    "unilateral" boolean,
    "equipment_id" bigint,
    "default_sets" integer,
    "default_reps" integer,
    "default_weight" integer,
    "default_rir" integer,
    "default_rest_sec" integer,
    "technique" "text"
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exercises_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exercises_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exercises_id_seq" OWNED BY "public"."exercises"."id";



CREATE TABLE IF NOT EXISTS "public"."fat_classification" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "benefits" "text",
    "risks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recomendations" "text"
);


ALTER TABLE "public"."fat_classification" OWNER TO "postgres";


COMMENT ON TABLE "public"."fat_classification" IS 'Clasificación de los tipos de grasa (saturada, insaturada, etc.) con sus beneficios y riesgos asociados.';



ALTER TABLE "public"."fat_classification" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."fat_classification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fat_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "benefit_description" "text",
    "risk_description" "text",
    "type" "text",
    "sigla" "text",
    "sigla_description" "text",
    "fat_classification_id" bigint,
    "carbon_chain" "text"
);


ALTER TABLE "public"."fat_types" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fat_types"."fat_classification_id" IS 'Relaciona el tipo de grasa con su clasificación general.';



ALTER TABLE "public"."fat_types" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."fat_types_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food" (
    "id" bigint NOT NULL,
    "name" "text",
    "food_type" "text",
    "food_unit" "text",
    "user_id" "uuid",
    "proteins" numeric,
    "protein_source_id" bigint,
    "total_carbs" numeric,
    "total_fats" numeric,
    "food_url" "text",
    "status" character varying(50),
    "grams_per_unit" numeric
);


ALTER TABLE "public"."food" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_aminogram_properties" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "aminogram_id" bigint NOT NULL,
    "property_type" "text" NOT NULL
);


ALTER TABLE "public"."food_aminogram_properties" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."food_aminogram_properties_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."food_aminogram_properties_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."food_aminogram_properties_id_seq" OWNED BY "public"."food_aminogram_properties"."id";



CREATE TABLE IF NOT EXISTS "public"."food_aminograms" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "aminogram_id" bigint NOT NULL,
    "mg_per_100g" numeric NOT NULL
);


ALTER TABLE "public"."food_aminograms" OWNER TO "postgres";


ALTER TABLE "public"."food_aminograms" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_aminograms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_antioxidants" (
    "food_id" bigint NOT NULL,
    "antioxidant_id" bigint NOT NULL
);


ALTER TABLE "public"."food_antioxidants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_carb_classification" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "classification_id" bigint NOT NULL,
    "grams" numeric NOT NULL
);


ALTER TABLE "public"."food_carb_classification" OWNER TO "postgres";


ALTER TABLE "public"."food_carb_classification" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_carb_classification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_carbs" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "carb_type_id" bigint NOT NULL,
    "grams" numeric NOT NULL
);


ALTER TABLE "public"."food_carbs" OWNER TO "postgres";


ALTER TABLE "public"."food_carbs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."food_carbs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_fat_classification" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "fat_classification_id" bigint NOT NULL,
    "grams" numeric NOT NULL
);


ALTER TABLE "public"."food_fat_classification" OWNER TO "postgres";


ALTER TABLE "public"."food_fat_classification" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_fat_classification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_fats" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "fat_type_id" bigint NOT NULL,
    "grams" numeric NOT NULL
);


ALTER TABLE "public"."food_fats" OWNER TO "postgres";


ALTER TABLE "public"."food_fats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."food_fats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_groups" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "origen" "text",
    "protein_source_id" bigint,
    "macro_role" "text"
);


ALTER TABLE "public"."food_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."food_groups"."macro_role" IS 'Clasifica el grupo para el algoritmo de autocuadre de macros (protein, carbs, fat, mixed)';



ALTER TABLE "public"."food_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."food_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."food_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."food_id_seq" OWNED BY "public"."food"."id";



CREATE TABLE IF NOT EXISTS "public"."food_medical_conditions" (
    "food_id" bigint NOT NULL,
    "condition_id" bigint NOT NULL,
    "relation_type" "text"
);


ALTER TABLE "public"."food_medical_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_minerals" (
    "food_id" bigint NOT NULL,
    "mineral_id" bigint NOT NULL,
    "mg_per_100g" numeric
);


ALTER TABLE "public"."food_minerals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_sensitivities" (
    "food_id" bigint NOT NULL,
    "sensitivity_id" bigint NOT NULL
);


ALTER TABLE "public"."food_sensitivities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_to_carb_subtypes" (
    "id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "subtype_id" bigint NOT NULL,
    "grams_per_100g" numeric,
    "classification_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fraction_of_total" numeric
);


ALTER TABLE "public"."food_to_carb_subtypes" OWNER TO "postgres";


ALTER TABLE "public"."food_to_carb_subtypes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_to_carb_subtypes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_to_food_groups" (
    "food_id" bigint NOT NULL,
    "food_group_id" bigint NOT NULL
);


ALTER TABLE "public"."food_to_food_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_to_macro_roles" (
    "food_id" bigint NOT NULL,
    "macro_role_id" bigint NOT NULL
);


ALTER TABLE "public"."food_to_macro_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_to_seasons" (
    "food_id" bigint NOT NULL,
    "season_id" bigint NOT NULL
);


ALTER TABLE "public"."food_to_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_to_stores" (
    "food_id" bigint NOT NULL,
    "store_id" bigint NOT NULL
);


ALTER TABLE "public"."food_to_stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_vitamins" (
    "food_id" bigint NOT NULL,
    "vitamin_id" bigint NOT NULL,
    "mg_per_100g" numeric
);


ALTER TABLE "public"."food_vitamins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."free_recipe_ingredients" (
    "id" bigint NOT NULL,
    "free_recipe_id" bigint NOT NULL,
    "food_id" bigint,
    "grams" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'linked'::"text" NOT NULL,
    "user_created_food_id" bigint
);


ALTER TABLE "public"."free_recipe_ingredients" OWNER TO "postgres";


ALTER TABLE "public"."free_recipe_ingredients" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."free_meal_ingredients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."free_recipes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "day_meal_id" bigint,
    "name" "text",
    "instructions" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "diet_plan_id" bigint,
    "prep_time_min" integer,
    "difficulty" "text",
    "parent_free_recipe_id" bigint,
    "parent_recipe_id" bigint
);


ALTER TABLE "public"."free_recipes" OWNER TO "postgres";


ALTER TABLE "public"."free_recipes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."free_meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."free_recipe_occurrences" (
    "id" bigint NOT NULL,
    "free_recipe_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "meal_date" "date" NOT NULL,
    "day_meal_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."free_recipe_occurrences" OWNER TO "postgres";


ALTER TABLE "public"."free_recipe_occurrences" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."free_recipe_occurrences_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."joints" (
    "id" bigint NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."joints" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."joints_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."joints_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."joints_id_seq" OWNED BY "public"."joints"."id";



CREATE TABLE IF NOT EXISTS "public"."macro_roles" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."macro_roles" OWNER TO "postgres";


ALTER TABLE "public"."macro_roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."macro_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."medical_conditions" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "recommendations" "text",
    "to_avoid" "text",
    "objective" "text"
);


ALTER TABLE "public"."medical_conditions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."medical_conditions"."to_avoid" IS 'Factores clave a tener en cuenta para evitar, tanto de alimentos como estilo de vida';



COMMENT ON COLUMN "public"."medical_conditions"."objective" IS 'Más preciso y claro que las recomendaciones, es el objetivo clave a tener en cuenta para la persona que sufre la patologia';



ALTER TABLE "public"."medical_conditions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."medical_conditions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."mesocycles" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "objective" "text",
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "public"."mesocycles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mesocycles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mesocycles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mesocycles_id_seq" OWNED BY "public"."mesocycles"."id";



CREATE TABLE IF NOT EXISTS "public"."minerals" (
    "id" bigint NOT NULL,
    "name" "text",
    "rdi_mg" integer,
    "mineral_type" "text"
);


ALTER TABLE "public"."minerals" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."minerals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."minerals_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."minerals_id_seq" OWNED BY "public"."minerals"."id";



CREATE TABLE IF NOT EXISTS "public"."muscle_joints" (
    "id" integer NOT NULL,
    "muscle_id" integer,
    "joint_id" integer
);


ALTER TABLE "public"."muscle_joints" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."muscle_joins_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."muscle_joins_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."muscle_joins_id_seq" OWNED BY "public"."muscle_joints"."id";



CREATE TABLE IF NOT EXISTS "public"."muscles" (
    "id" bigint NOT NULL,
    "name" "text",
    "partes_cuerpo" "text",
    "patron_movimiento" "text"
);


ALTER TABLE "public"."muscles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."muscles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."muscles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."muscles_id_seq" OWNED BY "public"."muscles"."id";



CREATE TABLE IF NOT EXISTS "public"."non_preferred_foods" (
    "user_id" "uuid" NOT NULL,
    "food_id" bigint NOT NULL
);


ALTER TABLE "public"."non_preferred_foods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_adherence_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "planned_meals_count" integer NOT NULL,
    "consumed_meals_count" integer NOT NULL,
    "adherence_ratio" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."plan_adherence_logs" OWNER TO "postgres";


ALTER TABLE "public"."plan_adherence_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."plan_adherence_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."planned_meals" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "diet_plan_id" bigint NOT NULL,
    "diet_plan_recipe_id" bigint,
    "private_recipe_id" bigint,
    "free_recipe_id" bigint,
    "day_meal_id" bigint NOT NULL,
    "plan_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "chk_one_meal_type" CHECK (((("diet_plan_recipe_id" IS NOT NULL) AND ("private_recipe_id" IS NULL) AND ("free_recipe_id" IS NULL)) OR (("diet_plan_recipe_id" IS NULL) AND ("private_recipe_id" IS NOT NULL) AND ("free_recipe_id" IS NULL)) OR (("diet_plan_recipe_id" IS NULL) AND ("private_recipe_id" IS NULL) AND ("free_recipe_id" IS NOT NULL))))
);


ALTER TABLE "public"."planned_meals" OWNER TO "postgres";


ALTER TABLE "public"."planned_meals" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."planned_meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."preferred_foods" (
    "user_id" "uuid" NOT NULL,
    "food_id" bigint NOT NULL
);


ALTER TABLE "public"."preferred_foods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."private_recipe_ingredients" (
    "id" bigint NOT NULL,
    "private_recipe_id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "grams" numeric(10,2) NOT NULL
);


ALTER TABLE "public"."private_recipe_ingredients" OWNER TO "postgres";


ALTER TABLE "public"."private_recipe_ingredients" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."private_recipe_ingredients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."private_recipes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_free_recipe_id" bigint,
    "name" "text" NOT NULL,
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "diet_plan_id" bigint,
    "day_meal_id" bigint,
    "prep_time_min" integer,
    "difficulty" "text",
    "parent_private_recipe_id" bigint
);


ALTER TABLE "public"."private_recipes" OWNER TO "postgres";


ALTER TABLE "public"."private_recipes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."private_recipes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."private_shopping_list_items" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "is_checked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."private_shopping_list_items" OWNER TO "postgres";


ALTER TABLE "public"."private_shopping_list_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."private_shopping_list_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "sex" "text",
    "height_cm" integer,
    "current_weight_kg" integer,
    "goal_weight_kg" integer,
    "phone" "text",
    "city" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "activity_level_id" integer,
    "birth_date" "date",
    "ger_kcal" integer,
    "tdee_kcal" integer,
    "email" "text",
    "profile_type" "text" DEFAULT 'free'::"text",
    "onboarding_version" "text",
    "onboarding_step_id" "text",
    "onboarding_completed_at" timestamp with time zone,
    "has_seen_quick_guide" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protein_sources" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "diaas_range" "text"
);


ALTER TABLE "public"."protein_sources" OWNER TO "postgres";


ALTER TABLE "public"."protein_sources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."protein_sources_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "recipe_id" bigint NOT NULL,
    "food_id" bigint NOT NULL,
    "grams" integer,
    "food_group_id" bigint
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_macros" (
    "id" bigint NOT NULL,
    "recipe_id" bigint,
    "diet_plan_recipe_id" bigint,
    "calories" numeric(8,2) DEFAULT 0 NOT NULL,
    "proteins" numeric(8,2) DEFAULT 0 NOT NULL,
    "carbs" numeric(8,2) DEFAULT 0 NOT NULL,
    "fats" numeric(8,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recipe_macros_unique_recipe" CHECK (((("recipe_id" IS NOT NULL) AND ("diet_plan_recipe_id" IS NULL)) OR (("recipe_id" IS NULL) AND ("diet_plan_recipe_id" IS NOT NULL))))
);


ALTER TABLE "public"."recipe_macros" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recipe_macros_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recipe_macros_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."recipe_macros_id_seq" OWNED BY "public"."recipe_macros"."id";



CREATE TABLE IF NOT EXISTS "public"."recipe_medical_conditions" (
    "recipe_id" bigint NOT NULL,
    "condition_id" bigint NOT NULL
);


ALTER TABLE "public"."recipe_medical_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_sensitivities" (
    "recipe_id" bigint NOT NULL,
    "sensitivity_id" bigint NOT NULL
);


ALTER TABLE "public"."recipe_sensitivities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_utilities" (
    "recipe_id" bigint NOT NULL,
    "utility_id" bigint NOT NULL
);


ALTER TABLE "public"."recipe_utilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" bigint NOT NULL,
    "name" "text",
    "prep_time_min" integer,
    "difficulty" "text",
    "instructions" "text",
    "diet_type" "text",
    "created_by" "uuid",
    "parent_recipe_id" bigint,
    "image_url" "text"
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recipes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recipes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."recipes_id_seq" OWNED BY "public"."recipes"."id";



CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "title" "text",
    "content" "text" NOT NULL,
    "type" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "category" "text",
    "recurrence_type" "text",
    "recurrence_days" "text",
    "recurrence_interval" integer DEFAULT 1,
    "recurrence_month_day" integer,
    "recurrence_week_no" integer,
    "recurrence_day_of_week" integer,
    "recurrence_end_date" "date",
    CONSTRAINT "reminders_type_check" CHECK (("type" = ANY (ARRAY['event'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


ALTER TABLE "public"."reminders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."reminders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "role" "text"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."routines" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "mesocycle_id" bigint,
    "day_of_week" integer,
    "focus" "text",
    "total_duration_min" integer,
    "warmup" "text",
    "mobility" "text",
    "feedback" "text",
    "name" "text"
);


ALTER TABLE "public"."routines" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."routines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."routines_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."routines_id_seq" OWNED BY "public"."routines"."id";



CREATE TABLE IF NOT EXISTS "public"."satiety_levels" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "value" integer NOT NULL
);


ALTER TABLE "public"."satiety_levels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."satiety_levels_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."satiety_levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."satiety_levels_id_seq" OWNED BY "public"."satiety_levels"."id";



CREATE TABLE IF NOT EXISTS "public"."season" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."season" OWNER TO "postgres";


ALTER TABLE "public"."season" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."season_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


ALTER TABLE "public"."seasons" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."seasons_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sensitivities" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "recommendations" "text",
    "to_avoid" "text",
    "is_ue_regulated" boolean
);


ALTER TABLE "public"."sensitivities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sensitivities"."to_avoid" IS 'Recomendaciones a evitar, tanto de alimentos como estilo de vida';



COMMENT ON COLUMN "public"."sensitivities"."is_ue_regulated" IS 'Marca si es una restricción alimentaria regulada por la Unión Europea';



ALTER TABLE "public"."sensitivities" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sensitivities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."shopping_list_items" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "food_id" bigint NOT NULL,
    "plan_id" bigint,
    "list_type" "text" NOT NULL,
    "list_date" "date" NOT NULL,
    "is_checked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shopping_list_items" OWNER TO "postgres";


ALTER TABLE "public"."shopping_list_items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."shopping_list_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."snack_ingredients" (
    "id" bigint NOT NULL,
    "snack_id" bigint NOT NULL,
    "food_id" bigint,
    "grams" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_created_food_id" bigint
);


ALTER TABLE "public"."snack_ingredients" OWNER TO "postgres";


ALTER TABLE "public"."snack_ingredients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."snack_ingredients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."snack_occurrences" (
    "id" bigint NOT NULL,
    "snack_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "meal_date" "date" NOT NULL,
    "day_meal_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snack_occurrences" OWNER TO "postgres";


ALTER TABLE "public"."snack_occurrences" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."snack_occurrences_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."snacks" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "diet_plan_id" bigint,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snacks" OWNER TO "postgres";


ALTER TABLE "public"."snacks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."snacks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


ALTER TABLE "public"."stores" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."stores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."training_preferences" (
    "user_id" "uuid" NOT NULL,
    "sessions_per_week" integer,
    "training_goal" "text",
    "discomforts" "text",
    "training_location" "text",
    "session_duration_min" integer,
    "training_preference" "text",
    "partner_training" boolean
);


ALTER TABLE "public"."training_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_centers" (
    "user_id" "uuid" NOT NULL,
    "center_id" bigint NOT NULL
);


ALTER TABLE "public"."user_centers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_created_food_minerals" (
    "user_created_food_id" bigint NOT NULL,
    "mineral_id" bigint NOT NULL,
    "mg_per_100g" numeric NOT NULL
);


ALTER TABLE "public"."user_created_food_minerals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_created_food_sensitivities" (
    "user_created_food_id" bigint NOT NULL,
    "sensitivity_id" bigint NOT NULL
);


ALTER TABLE "public"."user_created_food_sensitivities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_created_food_to_food_groups" (
    "user_created_food_id" bigint NOT NULL,
    "food_group_id" bigint NOT NULL
);


ALTER TABLE "public"."user_created_food_to_food_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_created_food_vitamins" (
    "user_created_food_id" bigint NOT NULL,
    "vitamin_id" bigint NOT NULL,
    "mg_per_100g" numeric NOT NULL
);


ALTER TABLE "public"."user_created_food_vitamins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_created_foods" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "proteins" numeric,
    "food_unit" "text" DEFAULT 'gramos'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "season_id" bigint,
    "selected_season_id" bigint,
    "linked_food_id" bigint,
    "old_fats_omega3" numeric,
    "old_fats_omega6" numeric,
    "fibers_soluble" numeric,
    "fibers_insoluble" numeric,
    "aminogram" "jsonb",
    "antioxidants" "jsonb",
    "sodium_mg" numeric,
    "store" "text",
    "antioxidant" boolean,
    "total_carbs" numeric,
    "total_fats" numeric,
    "saturadas" numeric,
    "monoinsaturadas" numeric,
    "poliinsaturadas" numeric,
    "sugars" numeric,
    "fiber" numeric,
    "store_id" bigint,
    "food_url" "text",
    "state" character varying(50),
    CONSTRAINT "user_created_foods_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved_general'::"text", 'approved_private'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."user_created_foods" OWNER TO "postgres";


ALTER TABLE "public"."user_created_foods" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."user_created_foods_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_day_meals" (
    "user_id" "uuid" NOT NULL,
    "day_meal_id" bigint NOT NULL,
    "target_calories" numeric,
    "target_proteins" numeric,
    "target_carbs" numeric,
    "target_fats" numeric,
    "preferences" "text",
    "protein_pct" integer,
    "carbs_pct" integer,
    "fat_pct" integer,
    "id" bigint NOT NULL,
    "diet_plan_id" bigint
);


ALTER TABLE "public"."user_day_meals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_day_meals"."protein_pct" IS 'Porcentaje de la proteína TOTAL del día asignado a esta comida.';



COMMENT ON COLUMN "public"."user_day_meals"."carbs_pct" IS 'Porcentaje de los carbohidratos TOTALES del día asignado a esta comida.';



COMMENT ON COLUMN "public"."user_day_meals"."fat_pct" IS 'Porcentaje de la grasa TOTAL del día asignada a esta comida.';



ALTER TABLE "public"."user_day_meals" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_day_meals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_individual_food_restrictions" (
    "user_id" "uuid" NOT NULL,
    "food_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_individual_food_restrictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_medical_conditions" (
    "user_id" "uuid" NOT NULL,
    "condition_id" bigint NOT NULL
);


ALTER TABLE "public"."user_medical_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


ALTER TABLE "public"."user_notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" integer
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sensitivities" (
    "user_id" "uuid" NOT NULL,
    "sensitivity_id" bigint NOT NULL,
    "sensitivitie_level" "text"
);


ALTER TABLE "public"."user_sensitivities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_sensitivities"."sensitivitie_level" IS 'Bajo, Moderado o Alto';



CREATE TABLE IF NOT EXISTS "public"."user_utilities" (
    "user_id" "uuid" NOT NULL,
    "utility_id" bigint NOT NULL
);


ALTER TABLE "public"."user_utilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utilities" (
    "id" bigint NOT NULL,
    "name" "text",
    "description" "text"
);


ALTER TABLE "public"."utilities" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."utilities_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."utilities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."utilities_id_seq" OWNED BY "public"."utilities"."id";



CREATE TABLE IF NOT EXISTS "public"."vitamins" (
    "id" bigint NOT NULL,
    "name" "text",
    "rda" "text",
    "vitamin_type" "text",
    "key_function" "text",
    "deficiency_risks" "text",
    "vitamin" "text",
    "details" "text"
);


ALTER TABLE "public"."vitamins" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."vitamins_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vitamins_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."vitamins_id_seq" OWNED BY "public"."vitamins"."id";



CREATE TABLE IF NOT EXISTS "public"."weight_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "logged_on" "date" DEFAULT CURRENT_DATE,
    "weight_kg" numeric(5,1),
    "description" "text",
    "satiety_level_id" integer
);


ALTER TABLE "public"."weight_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."weight_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."weight_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."weight_logs_id_seq" OWNED BY "public"."weight_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."workout_exercises" (
    "id" bigint NOT NULL,
    "workout_id" bigint,
    "exercise_id" bigint,
    "sequence" integer,
    "superserie" boolean DEFAULT false,
    "feedback" "text"
);


ALTER TABLE "public"."workout_exercises" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."workout_exercises_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."workout_exercises_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."workout_exercises_id_seq" OWNED BY "public"."workout_exercises"."id";



CREATE TABLE IF NOT EXISTS "public"."workouts" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "routine_id" bigint,
    "performed_on" "date" DEFAULT CURRENT_DATE
);


ALTER TABLE "public"."workouts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."workouts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."workouts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."workouts_id_seq" OWNED BY "public"."workouts"."id";



ALTER TABLE ONLY "public"."activity_levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."activity_levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."diet_plan_recipe_ingredients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."diet_plan_recipe_ingredients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."diet_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."diet_plans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."equipment" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."equipment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exercise_sets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exercise_sets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exercises" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exercises_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."food" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."food_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."food_aminogram_properties" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."food_aminogram_properties_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."joints" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."joints_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mesocycles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mesocycles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."minerals" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."minerals_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."muscle_joints" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."muscle_joins_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."muscles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."muscles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."recipe_macros" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."recipe_macros_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."recipes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."recipes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."routines" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."routines_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."satiety_levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."satiety_levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."utilities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."utilities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."vitamins" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."vitamins_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."weight_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."weight_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."workout_exercises" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."workout_exercises_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."workouts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."workouts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_levels"
    ADD CONSTRAINT "activity_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisories"
    ADD CONSTRAINT "advisories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aminograms"
    ADD CONSTRAINT "aminograms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."antioxidants"
    ADD CONSTRAINT "antioxidants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_progress"
    ADD CONSTRAINT "assignment_progress_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."carb_classification"
    ADD CONSTRAINT "carb_classification_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."carb_classification"
    ADD CONSTRAINT "carb_classification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carb_subtypes"
    ADD CONSTRAINT "carb_subtypes_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."carb_subtypes"
    ADD CONSTRAINT "carb_subtypes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carb_types"
    ADD CONSTRAINT "carb_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."carb_types"
    ADD CONSTRAINT "carb_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centers"
    ADD CONSTRAINT "centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_clients"
    ADD CONSTRAINT "coach_clients_coach_id_client_id_key" UNIQUE ("coach_id", "client_id");



ALTER TABLE ONLY "public"."coach_clients"
    ADD CONSTRAINT "coach_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_plan_snapshots"
    ADD CONSTRAINT "daily_plan_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_plan_snapshots"
    ADD CONSTRAINT "daily_plan_snapshots_user_id_log_date_key" UNIQUE ("user_id", "log_date");



ALTER TABLE ONLY "public"."daily_snack_logs"
    ADD CONSTRAINT "daily_snack_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."day_meals"
    ADD CONSTRAINT "day_meals_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."day_meals"
    ADD CONSTRAINT "day_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "diet_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_goals"
    ADD CONSTRAINT "diet_goals_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."diet_goals"
    ADD CONSTRAINT "diet_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_plan_calorie_overrides"
    ADD CONSTRAINT "diet_plan_calorie_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_plan_centers"
    ADD CONSTRAINT "diet_plan_centers_pkey" PRIMARY KEY ("diet_plan_id", "center_id");



ALTER TABLE ONLY "public"."diet_plan_medical_conditions"
    ADD CONSTRAINT "diet_plan_medical_conditions_pkey" PRIMARY KEY ("diet_plan_id", "condition_id");



ALTER TABLE ONLY "public"."diet_plan_recipe_ingredients"
    ADD CONSTRAINT "diet_plan_recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "diet_plan_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_plan_sensitivities"
    ADD CONSTRAINT "diet_plan_sensitivities_pkey" PRIMARY KEY ("diet_plan_id", "sensitivity_id");



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "diet_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."diet_types"
    ADD CONSTRAINT "diet_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."diet_types"
    ADD CONSTRAINT "diet_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_joints"
    ADD CONSTRAINT "exercise_joints_pkey" PRIMARY KEY ("exercise_id", "joint_id");



ALTER TABLE ONLY "public"."exercise_muscles"
    ADD CONSTRAINT "exercise_muscles_pkey" PRIMARY KEY ("exercise_id", "muscle_id");



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fat_classification"
    ADD CONSTRAINT "fat_classification_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."fat_classification"
    ADD CONSTRAINT "fat_classification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fat_types"
    ADD CONSTRAINT "fat_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."fat_types"
    ADD CONSTRAINT "fat_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_aminogram_properties"
    ADD CONSTRAINT "food_aminogram_properties_food_id_aminogram_id_property_typ_key" UNIQUE ("food_id", "aminogram_id", "property_type");



ALTER TABLE ONLY "public"."food_aminogram_properties"
    ADD CONSTRAINT "food_aminogram_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_aminograms"
    ADD CONSTRAINT "food_aminograms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_aminograms"
    ADD CONSTRAINT "food_aminograms_unique" UNIQUE ("food_id", "aminogram_id");



ALTER TABLE ONLY "public"."food_antioxidants"
    ADD CONSTRAINT "food_antioxidants_pkey" PRIMARY KEY ("food_id", "antioxidant_id");



ALTER TABLE ONLY "public"."food_carb_classification"
    ADD CONSTRAINT "food_carb_classification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_carbs"
    ADD CONSTRAINT "food_carbs_food_id_carb_type_id_key" UNIQUE ("food_id", "carb_type_id");



ALTER TABLE ONLY "public"."food_carbs"
    ADD CONSTRAINT "food_carbs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_fat_classification"
    ADD CONSTRAINT "food_fat_classification_food_id_fat_classification_id_key" UNIQUE ("food_id", "fat_classification_id");



ALTER TABLE ONLY "public"."food_fat_classification"
    ADD CONSTRAINT "food_fat_classification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_fats"
    ADD CONSTRAINT "food_fats_food_id_fat_type_id_key" UNIQUE ("food_id", "fat_type_id");



ALTER TABLE ONLY "public"."food_fats"
    ADD CONSTRAINT "food_fats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_groups"
    ADD CONSTRAINT "food_groups_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."food_groups"
    ADD CONSTRAINT "food_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_medical_conditions"
    ADD CONSTRAINT "food_medical_conditions_pkey" PRIMARY KEY ("food_id", "condition_id");



ALTER TABLE ONLY "public"."food_minerals"
    ADD CONSTRAINT "food_minerals_pkey" PRIMARY KEY ("food_id", "mineral_id");



ALTER TABLE ONLY "public"."food"
    ADD CONSTRAINT "food_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_sensitivities"
    ADD CONSTRAINT "food_sensitivities_pkey" PRIMARY KEY ("food_id", "sensitivity_id");



ALTER TABLE ONLY "public"."food_to_carb_subtypes"
    ADD CONSTRAINT "food_to_carb_subtypes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_to_food_groups"
    ADD CONSTRAINT "food_to_food_groups_pkey" PRIMARY KEY ("food_id", "food_group_id");



ALTER TABLE ONLY "public"."food_to_macro_roles"
    ADD CONSTRAINT "food_to_macro_roles_pkey" PRIMARY KEY ("food_id", "macro_role_id");



ALTER TABLE ONLY "public"."food_to_seasons"
    ADD CONSTRAINT "food_to_seasons_pkey" PRIMARY KEY ("food_id", "season_id");



ALTER TABLE ONLY "public"."food_to_stores"
    ADD CONSTRAINT "food_to_stores_pkey" PRIMARY KEY ("food_id", "store_id");



ALTER TABLE ONLY "public"."food_vitamins"
    ADD CONSTRAINT "food_vitamins_pkey" PRIMARY KEY ("food_id", "vitamin_id");



ALTER TABLE ONLY "public"."free_recipe_ingredients"
    ADD CONSTRAINT "free_meal_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "free_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."joints"
    ADD CONSTRAINT "joints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."macro_roles"
    ADD CONSTRAINT "macro_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."macro_roles"
    ADD CONSTRAINT "macro_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_conditions"
    ADD CONSTRAINT "medical_conditions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."medical_conditions"
    ADD CONSTRAINT "medical_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mesocycles"
    ADD CONSTRAINT "mesocycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."minerals"
    ADD CONSTRAINT "minerals_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."minerals"
    ADD CONSTRAINT "minerals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscle_joints"
    ADD CONSTRAINT "muscle_joins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muscles"
    ADD CONSTRAINT "muscles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."non_preferred_foods"
    ADD CONSTRAINT "non_preferred_foods_pkey" PRIMARY KEY ("user_id", "food_id");



ALTER TABLE ONLY "public"."plan_adherence_logs"
    ADD CONSTRAINT "plan_adherence_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_adherence_logs"
    ADD CONSTRAINT "plan_adherence_logs_user_id_log_date_key" UNIQUE ("user_id", "log_date");



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preferred_foods"
    ADD CONSTRAINT "preferred_foods_pkey" PRIMARY KEY ("user_id", "food_id");



ALTER TABLE ONLY "public"."private_recipe_ingredients"
    ADD CONSTRAINT "private_recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."private_shopping_list_items"
    ADD CONSTRAINT "private_shopping_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."private_shopping_list_items"
    ADD CONSTRAINT "private_shopping_list_items_user_id_item_name_key" UNIQUE ("user_id", "item_name");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."protein_sources"
    ADD CONSTRAINT "protein_sources_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."protein_sources"
    ADD CONSTRAINT "protein_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("recipe_id", "food_id");



ALTER TABLE ONLY "public"."recipe_macros"
    ADD CONSTRAINT "recipe_macros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_medical_conditions"
    ADD CONSTRAINT "recipe_medical_conditions_pkey" PRIMARY KEY ("recipe_id", "condition_id");



ALTER TABLE ONLY "public"."recipe_sensitivities"
    ADD CONSTRAINT "recipe_sensitivities_pkey" PRIMARY KEY ("recipe_id", "sensitivity_id");



ALTER TABLE ONLY "public"."recipe_utilities"
    ADD CONSTRAINT "recipe_utilities_pkey" PRIMARY KEY ("recipe_id", "utility_id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_key" UNIQUE ("role");



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."satiety_levels"
    ADD CONSTRAINT "satiety_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season"
    ADD CONSTRAINT "season_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."season"
    ADD CONSTRAINT "season_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sensitivities"
    ADD CONSTRAINT "sensitivities_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."sensitivities"
    ADD CONSTRAINT "sensitivities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_user_id_food_id_list_type_list_date_key" UNIQUE ("user_id", "food_id", "list_type", "list_date");



ALTER TABLE ONLY "public"."snack_ingredients"
    ADD CONSTRAINT "snack_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snack_occurrences"
    ADD CONSTRAINT "snack_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snacks"
    ADD CONSTRAINT "snacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_preferences"
    ADD CONSTRAINT "training_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."food_carb_classification"
    ADD CONSTRAINT "unique_food_carb_classification" UNIQUE ("food_id", "classification_id");



ALTER TABLE ONLY "public"."food_to_carb_subtypes"
    ADD CONSTRAINT "unique_food_subtype" UNIQUE ("food_id", "subtype_id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "unique_user_day_log" UNIQUE ("user_id", "log_date", "user_day_meal_id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "unique_user_day_meal" UNIQUE ("user_id", "log_date", "user_day_meal_id");



ALTER TABLE ONLY "public"."user_centers"
    ADD CONSTRAINT "user_centers_pkey" PRIMARY KEY ("user_id", "center_id");



ALTER TABLE ONLY "public"."user_created_food_minerals"
    ADD CONSTRAINT "user_created_food_minerals_pkey" PRIMARY KEY ("user_created_food_id", "mineral_id");



ALTER TABLE ONLY "public"."user_created_food_sensitivities"
    ADD CONSTRAINT "user_created_food_sensitivities_pkey" PRIMARY KEY ("user_created_food_id", "sensitivity_id");



ALTER TABLE ONLY "public"."user_created_food_to_food_groups"
    ADD CONSTRAINT "user_created_food_to_food_groups_pkey" PRIMARY KEY ("user_created_food_id", "food_group_id");



ALTER TABLE ONLY "public"."user_created_food_vitamins"
    ADD CONSTRAINT "user_created_food_vitamins_pkey" PRIMARY KEY ("user_created_food_id", "vitamin_id");



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "user_created_foods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_individual_food_restrictions"
    ADD CONSTRAINT "user_individual_food_restrictions_pkey" PRIMARY KEY ("user_id", "food_id");



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_pkey" PRIMARY KEY ("user_id", "condition_id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_pkey" PRIMARY KEY ("user_id", "sensitivity_id");



ALTER TABLE ONLY "public"."user_utilities"
    ADD CONSTRAINT "user_utilities_pkey" PRIMARY KEY ("user_id", "utility_id");



ALTER TABLE ONLY "public"."utilities"
    ADD CONSTRAINT "utilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vitamins"
    ADD CONSTRAINT "vitamins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weight_logs"
    ADD CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_carb_subtypes_classification_id" ON "public"."carb_subtypes" USING "btree" ("classification_id");



CREATE INDEX "idx_diet_plan_calorie_overrides_user_id" ON "public"."diet_plan_calorie_overrides" USING "btree" ("user_id");



CREATE INDEX "idx_diet_plan_calorie_overrides_user_plan" ON "public"."diet_plan_calorie_overrides" USING "btree" ("user_id", "diet_plan_id");



CREATE INDEX "idx_diet_plan_recipe_ingredients_diet_plan_recipe_id" ON "public"."diet_plan_recipe_ingredients" USING "btree" ("diet_plan_recipe_id");



CREATE INDEX "idx_diet_plan_recipe_ingredients_food_id" ON "public"."diet_plan_recipe_ingredients" USING "btree" ("food_id");



CREATE INDEX "idx_free_meals_status" ON "public"."free_recipes" USING "btree" ("status");



CREATE INDEX "idx_profiles_has_seen_quick_guide" ON "public"."profiles" USING "btree" ("has_seen_quick_guide");



CREATE INDEX "idx_profiles_profile_type" ON "public"."profiles" USING "btree" ("profile_type");



CREATE INDEX "idx_recipe_macros_diet_plan_recipe_id" ON "public"."recipe_macros" USING "btree" ("diet_plan_recipe_id");



CREATE INDEX "idx_recipe_macros_recipe_id" ON "public"."recipe_macros" USING "btree" ("recipe_id");



CREATE UNIQUE INDEX "user_day_meals_base_unique_idx" ON "public"."user_day_meals" USING "btree" ("user_id", "day_meal_id") WHERE ("diet_plan_id" IS NULL);



CREATE UNIQUE INDEX "user_day_meals_plan_unique_idx" ON "public"."user_day_meals" USING "btree" ("user_id", "day_meal_id", "diet_plan_id") WHERE ("diet_plan_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."diet_plans" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."private_shopping_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."shopping_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "on_diet_change_request_status_update" AFTER UPDATE ON "public"."diet_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."create_diet_change_notification"();



CREATE OR REPLACE TRIGGER "on_equivalence_adjustment_created" AFTER INSERT ON "public"."equivalence_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_equivalence_balance"();



CREATE OR REPLACE TRIGGER "on_private_recipe_creation_from_free_meal" AFTER INSERT ON "public"."private_recipes" FOR EACH ROW WHEN (("new"."source_free_recipe_id" IS NOT NULL)) EXECUTE FUNCTION "public"."create_private_recipe_notification"();



CREATE OR REPLACE TRIGGER "on_weight_log_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."weight_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_current_weight"();



ALTER TABLE ONLY "public"."advisories"
    ADD CONSTRAINT "advisories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."antioxidants"
    ADD CONSTRAINT "antioxidants_mineral_id_fkey" FOREIGN KEY ("mineral_id") REFERENCES "public"."minerals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."antioxidants"
    ADD CONSTRAINT "antioxidants_vitamin_id_fkey" FOREIGN KEY ("vitamin_id") REFERENCES "public"."vitamins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_progress"
    ADD CONSTRAINT "assignment_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carb_subtypes"
    ADD CONSTRAINT "carb_subtypes_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "public"."carb_classification"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_clients"
    ADD CONSTRAINT "coach_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."coach_clients"
    ADD CONSTRAINT "coach_clients_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_equivalence_adjustment_id_fkey" FOREIGN KEY ("equivalence_adjustment_id") REFERENCES "public"."equivalence_adjustments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_private_recipe_id_fkey" FOREIGN KEY ("private_recipe_id") REFERENCES "public"."private_recipes"("id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_free_recipe_occurrence_id_fkey" FOREIGN KEY ("free_recipe_occurrence_id") REFERENCES "public"."free_recipe_occurrences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_private_recipe_id_fkey" FOREIGN KEY ("private_recipe_id") REFERENCES "public"."private_recipes"("id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_user_day_meal_id_fkey" FOREIGN KEY ("user_day_meal_id") REFERENCES "public"."user_day_meals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_plan_snapshots"
    ADD CONSTRAINT "daily_plan_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_snack_logs"
    ADD CONSTRAINT "daily_snack_logs_snack_occurrence_id_fkey" FOREIGN KEY ("snack_occurrence_id") REFERENCES "public"."snack_occurrences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_snack_logs"
    ADD CONSTRAINT "daily_snack_logs_user_day_meal_id_fkey" FOREIGN KEY ("user_day_meal_id") REFERENCES "public"."user_day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_snack_logs"
    ADD CONSTRAINT "daily_snack_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "diet_change_requests_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "diet_change_requests_requested_changes_private_recipe_id_fkey" FOREIGN KEY ("requested_changes_private_recipe_id") REFERENCES "public"."private_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "diet_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_calorie_overrides"
    ADD CONSTRAINT "diet_plan_calorie_overrides_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_calorie_overrides"
    ADD CONSTRAINT "diet_plan_calorie_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."diet_plan_centers"
    ADD CONSTRAINT "diet_plan_centers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."diet_plan_centers"
    ADD CONSTRAINT "diet_plan_centers_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_centers"
    ADD CONSTRAINT "diet_plan_centers_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_medical_conditions"
    ADD CONSTRAINT "diet_plan_medical_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_medical_conditions"
    ADD CONSTRAINT "diet_plan_medical_conditions_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_recipe_ingredients"
    ADD CONSTRAINT "diet_plan_recipe_ingredients_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_recipe_ingredients"
    ADD CONSTRAINT "diet_plan_recipe_ingredients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "diet_plan_recipes_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id");



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "diet_plan_recipes_parent_diet_plan_recipe_id_fkey" FOREIGN KEY ("parent_diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id");



ALTER TABLE ONLY "public"."diet_plan_sensitivities"
    ADD CONSTRAINT "diet_plan_sensitivities_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plan_sensitivities"
    ADD CONSTRAINT "diet_plan_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "diet_plans_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id");



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "diet_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "diet_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "diet_preferences_diet_goal_id_fkey" FOREIGN KEY ("diet_goal_id") REFERENCES "public"."diet_goals"("id");



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "diet_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_daily_snack_log_id_fkey" FOREIGN KEY ("source_daily_snack_log_id") REFERENCES "public"."daily_snack_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_diet_plan_recipe_id_fkey" FOREIGN KEY ("source_diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_free_recipe_id_fkey" FOREIGN KEY ("source_free_recipe_id") REFERENCES "public"."free_recipes"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_free_recipe_occurrence_id_fkey" FOREIGN KEY ("source_free_recipe_occurrence_id") REFERENCES "public"."free_recipe_occurrences"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_private_recipe_id_fkey" FOREIGN KEY ("source_private_recipe_id") REFERENCES "public"."private_recipes"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_target_user_day_meal_id_fkey" FOREIGN KEY ("target_user_day_meal_id") REFERENCES "public"."user_day_meals"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."exercise_joints"
    ADD CONSTRAINT "exercise_joints_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_joints"
    ADD CONSTRAINT "exercise_joints_joint_id_fkey" FOREIGN KEY ("joint_id") REFERENCES "public"."joints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_muscles"
    ADD CONSTRAINT "exercise_muscles_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_muscles"
    ADD CONSTRAINT "exercise_muscles_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_sets"
    ADD CONSTRAINT "exercise_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");



ALTER TABLE ONLY "public"."food_antioxidants"
    ADD CONSTRAINT "fk_antioxidant" FOREIGN KEY ("antioxidant_id") REFERENCES "public"."antioxidants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carb_classification"
    ADD CONSTRAINT "fk_carb_type" FOREIGN KEY ("carb_type_id") REFERENCES "public"."carb_types"("id");



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "fk_diet_plan" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "fk_diet_plan" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "fk_diet_type" FOREIGN KEY ("diet_type_id") REFERENCES "public"."diet_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fat_types"
    ADD CONSTRAINT "fk_fat_classification" FOREIGN KEY ("fat_classification_id") REFERENCES "public"."fat_classification"("id");



ALTER TABLE ONLY "public"."food_antioxidants"
    ADD CONSTRAINT "fk_food" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "fk_private_recipe" FOREIGN KEY ("private_recipe_id") REFERENCES "public"."private_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_groups"
    ADD CONSTRAINT "fk_protein_source" FOREIGN KEY ("protein_source_id") REFERENCES "public"."protein_sources"("id");



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "fk_recipe" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "fk_source_template" FOREIGN KEY ("source_template_id") REFERENCES "public"."diet_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "fk_user_created_foods_linked_food_id" FOREIGN KEY ("linked_food_id") REFERENCES "public"."food"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_aminogram_properties"
    ADD CONSTRAINT "food_aminogram_properties_aminogram_id_fkey" FOREIGN KEY ("aminogram_id") REFERENCES "public"."aminograms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_aminogram_properties"
    ADD CONSTRAINT "food_aminogram_properties_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_aminograms"
    ADD CONSTRAINT "food_aminograms_aminogram_id_fkey" FOREIGN KEY ("aminogram_id") REFERENCES "public"."aminograms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_aminograms"
    ADD CONSTRAINT "food_aminograms_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_carb_classification"
    ADD CONSTRAINT "food_carb_classification_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "public"."carb_classification"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_carb_classification"
    ADD CONSTRAINT "food_carb_classification_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_carbs"
    ADD CONSTRAINT "food_carbs_carb_type_id_fkey" FOREIGN KEY ("carb_type_id") REFERENCES "public"."carb_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_carbs"
    ADD CONSTRAINT "food_carbs_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_fat_classification"
    ADD CONSTRAINT "food_fat_classification_fat_classification_id_fkey" FOREIGN KEY ("fat_classification_id") REFERENCES "public"."fat_classification"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_fat_classification"
    ADD CONSTRAINT "food_fat_classification_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_fats"
    ADD CONSTRAINT "food_fats_fat_type_id_fkey" FOREIGN KEY ("fat_type_id") REFERENCES "public"."fat_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_fats"
    ADD CONSTRAINT "food_fats_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_medical_conditions"
    ADD CONSTRAINT "food_medical_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_medical_conditions"
    ADD CONSTRAINT "food_medical_conditions_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_minerals"
    ADD CONSTRAINT "food_minerals_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_minerals"
    ADD CONSTRAINT "food_minerals_mineral_id_fkey" FOREIGN KEY ("mineral_id") REFERENCES "public"."minerals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food"
    ADD CONSTRAINT "food_protein_source_id_fkey" FOREIGN KEY ("protein_source_id") REFERENCES "public"."protein_sources"("id");



ALTER TABLE ONLY "public"."food_sensitivities"
    ADD CONSTRAINT "food_sensitivities_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_sensitivities"
    ADD CONSTRAINT "food_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_carb_subtypes"
    ADD CONSTRAINT "food_to_carb_subtypes_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "public"."carb_classification"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_carb_subtypes"
    ADD CONSTRAINT "food_to_carb_subtypes_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_carb_subtypes"
    ADD CONSTRAINT "food_to_carb_subtypes_subtype_id_fkey" FOREIGN KEY ("subtype_id") REFERENCES "public"."carb_subtypes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_food_groups"
    ADD CONSTRAINT "food_to_food_groups_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_food_groups"
    ADD CONSTRAINT "food_to_food_groups_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_macro_roles"
    ADD CONSTRAINT "food_to_macro_roles_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_macro_roles"
    ADD CONSTRAINT "food_to_macro_roles_macro_role_id_fkey" FOREIGN KEY ("macro_role_id") REFERENCES "public"."macro_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_seasons"
    ADD CONSTRAINT "food_to_seasons_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_seasons"
    ADD CONSTRAINT "food_to_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_stores"
    ADD CONSTRAINT "food_to_stores_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_to_stores"
    ADD CONSTRAINT "food_to_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food"
    ADD CONSTRAINT "food_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."food_vitamins"
    ADD CONSTRAINT "food_vitamins_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_vitamins"
    ADD CONSTRAINT "food_vitamins_vitamin_id_fkey" FOREIGN KEY ("vitamin_id") REFERENCES "public"."vitamins"("id");



ALTER TABLE ONLY "public"."free_recipe_ingredients"
    ADD CONSTRAINT "free_meal_ingredients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_ingredients"
    ADD CONSTRAINT "free_meal_ingredients_free_meal_id_fkey" FOREIGN KEY ("free_recipe_id") REFERENCES "public"."free_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "free_meals_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id");



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "free_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_ingredients"
    ADD CONSTRAINT "free_recipe_ingredients_user_created_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_free_recipe_id_fkey" FOREIGN KEY ("free_recipe_id") REFERENCES "public"."free_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "free_recipes_parent_free_recipe_id_fkey" FOREIGN KEY ("parent_free_recipe_id") REFERENCES "public"."free_recipes"("id");



ALTER TABLE ONLY "public"."free_recipes"
    ADD CONSTRAINT "free_recipes_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."mesocycles"
    ADD CONSTRAINT "mesocycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muscle_joints"
    ADD CONSTRAINT "muscle_joins_joitn_id_fkey" FOREIGN KEY ("joint_id") REFERENCES "public"."joints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muscle_joints"
    ADD CONSTRAINT "muscle_joins_muscle_id_fkey" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."non_preferred_foods"
    ADD CONSTRAINT "non_preferred_foods_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."non_preferred_foods"
    ADD CONSTRAINT "non_preferred_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_adherence_logs"
    ADD CONSTRAINT "plan_adherence_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_free_meal_id_fkey" FOREIGN KEY ("free_recipe_id") REFERENCES "public"."free_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_private_recipe_id_fkey" FOREIGN KEY ("private_recipe_id") REFERENCES "public"."private_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "planned_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferred_foods"
    ADD CONSTRAINT "preferred_foods_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferred_foods"
    ADD CONSTRAINT "preferred_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_recipe_ingredients"
    ADD CONSTRAINT "private_recipe_ingredients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_recipe_ingredients"
    ADD CONSTRAINT "private_recipe_ingredients_private_recipe_id_fkey" FOREIGN KEY ("private_recipe_id") REFERENCES "public"."private_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id");



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id");



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_parent_private_recipe_id_fkey" FOREIGN KEY ("parent_private_recipe_id") REFERENCES "public"."private_recipes"("id");



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_source_free_meal_id_fkey" FOREIGN KEY ("source_free_recipe_id") REFERENCES "public"."free_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."private_recipes"
    ADD CONSTRAINT "private_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_shopping_list_items"
    ADD CONSTRAINT "private_shopping_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_activity_level_id_fkey" FOREIGN KEY ("activity_level_id") REFERENCES "public"."activity_levels"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_macros"
    ADD CONSTRAINT "recipe_macros_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_macros"
    ADD CONSTRAINT "recipe_macros_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_medical_conditions"
    ADD CONSTRAINT "recipe_medical_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_medical_conditions"
    ADD CONSTRAINT "recipe_medical_conditions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_sensitivities"
    ADD CONSTRAINT "recipe_sensitivities_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_sensitivities"
    ADD CONSTRAINT "recipe_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_utilities"
    ADD CONSTRAINT "recipe_utilities_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_utilities"
    ADD CONSTRAINT "recipe_utilities_utility_id_fkey" FOREIGN KEY ("utility_id") REFERENCES "public"."utilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "public"."recipes"("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_mesocycle_id_fkey" FOREIGN KEY ("mesocycle_id") REFERENCES "public"."mesocycles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snack_ingredients"
    ADD CONSTRAINT "snack_ingredients_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."snack_ingredients"
    ADD CONSTRAINT "snack_ingredients_snack_id_fkey" FOREIGN KEY ("snack_id") REFERENCES "public"."snacks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snack_ingredients"
    ADD CONSTRAINT "snack_ingredients_user_created_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."snack_occurrences"
    ADD CONSTRAINT "snack_occurrences_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snack_occurrences"
    ADD CONSTRAINT "snack_occurrences_snack_id_fkey" FOREIGN KEY ("snack_id") REFERENCES "public"."snacks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snack_occurrences"
    ADD CONSTRAINT "snack_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snacks"
    ADD CONSTRAINT "snacks_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."snacks"
    ADD CONSTRAINT "snacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_preferences"
    ADD CONSTRAINT "training_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_centers"
    ADD CONSTRAINT "user_centers_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_centers"
    ADD CONSTRAINT "user_centers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_minerals"
    ADD CONSTRAINT "user_created_food_minerals_mineral_id_fkey" FOREIGN KEY ("mineral_id") REFERENCES "public"."minerals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_minerals"
    ADD CONSTRAINT "user_created_food_minerals_user_created_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_sensitivities"
    ADD CONSTRAINT "user_created_food_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_sensitivities"
    ADD CONSTRAINT "user_created_food_sensitivities_user_created_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_to_food_groups"
    ADD CONSTRAINT "user_created_food_to_food_groups_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_to_food_groups"
    ADD CONSTRAINT "user_created_food_to_food_groups_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_vitamins"
    ADD CONSTRAINT "user_created_food_vitamins_user_created_food_id_fkey" FOREIGN KEY ("user_created_food_id") REFERENCES "public"."user_created_foods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_food_vitamins"
    ADD CONSTRAINT "user_created_food_vitamins_vitamin_id_fkey" FOREIGN KEY ("vitamin_id") REFERENCES "public"."vitamins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "user_created_foods_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id");



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "user_created_foods_selected_season_id_fkey" FOREIGN KEY ("selected_season_id") REFERENCES "public"."season"("id");



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "user_created_foods_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."user_created_foods"
    ADD CONSTRAINT "user_created_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_individual_food_restrictions"
    ADD CONSTRAINT "user_individual_food_restrictions_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_individual_food_restrictions"
    ADD CONSTRAINT "user_individual_food_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_utilities"
    ADD CONSTRAINT "user_utilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_utilities"
    ADD CONSTRAINT "user_utilities_utility_id_fkey" FOREIGN KEY ("utility_id") REFERENCES "public"."utilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weight_logs"
    ADD CONSTRAINT "weight_logs_satiety_level_id_fkey" FOREIGN KEY ("satiety_level_id") REFERENCES "public"."satiety_levels"("id");



ALTER TABLE ONLY "public"."weight_logs"
    ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."workout_exercises"
    ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert templates" ON "public"."diet_plans" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage all calorie overrides" ON "public"."diet_plan_calorie_overrides" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage coach_clients" ON "public"."coach_clients" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Admins full access assignment progress" ON "public"."assignment_progress" USING ("public"."is_admin"());



CREATE POLICY "Admins full access diet_plan_centers" ON "public"."diet_plan_centers" USING ("public"."is_admin"());



CREATE POLICY "Admins full access diet_plans" ON "public"."diet_plans" USING ("public"."is_admin"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_aminogram_properties" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_aminograms" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_carbs" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_fats" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_medical_conditions" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_minerals" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_sensitivities" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_to_macro_roles" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_to_seasons" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_to_stores" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access" ON "public"."food_vitamins" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access on food_antioxidants" ON "public"."food_antioxidants" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access on food_carb_classification" ON "public"."food_carb_classification" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access on food_fat_classification" ON "public"."food_fat_classification" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin and coach full access on food_to_carb_subtypes" ON "public"."food_to_carb_subtypes" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow admin full access" ON "public"."carb_classification" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."carb_subtypes" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."diet_change_requests" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."diet_types" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."fat_classification" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."food_groups" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."season" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access" ON "public"."shopping_list_items" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access" ON "public"."user_created_food_sensitivities" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on activity_levels" ON "public"."activity_levels" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on adherence logs" ON "public"."plan_adherence_logs" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on advisories" ON "public"."advisories" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on aminograms" ON "public"."aminograms" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on antioxidants" ON "public"."antioxidants" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on calorie overrides" ON "public"."diet_plan_calorie_overrides" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on carb_types" ON "public"."carb_types" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on centers" ON "public"."centers" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on daily_ingredient_adjustments" ON "public"."daily_ingredient_adjustments" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on daily_plan_snapshots" ON "public"."daily_plan_snapshots" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on day_meals" ON "public"."day_meals" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on diet_change_requests" ON "public"."diet_change_requests" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on diet_plan_medical_conditions" ON "public"."diet_plan_medical_conditions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on diet_plan_recipe_ingredients" ON "public"."diet_plan_recipe_ingredients" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on diet_plan_recipes" ON "public"."diet_plan_recipes" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on diet_plan_sensitivities" ON "public"."diet_plan_sensitivities" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on diet_plans" ON "public"."diet_plans" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on diet_preferences" ON "public"."diet_preferences" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on equivalence_adjustments" ON "public"."equivalence_adjustments" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on exercise_muscles" ON "public"."exercise_muscles" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on exercises" ON "public"."exercises" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on fat_types" ON "public"."fat_types" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on food" ON "public"."food" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on food_to_food_groups" ON "public"."food_to_food_groups" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on free meal ingredients" ON "public"."free_recipe_ingredients" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on free meals" ON "public"."free_recipes" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on free recipe occurrences" ON "public"."free_recipe_occurrences" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on individual food restrictions" ON "public"."user_individual_food_restrictions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on meal logs" ON "public"."daily_meal_logs" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on mesocycles" ON "public"."mesocycles" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on planned meals" ON "public"."planned_meals" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on protein_sources" ON "public"."protein_sources" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on recipe_ingredients" ON "public"."recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on recipe_macros" ON "public"."recipe_macros" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on recipe_sensitivities" ON "public"."recipe_sensitivities" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on recipes" ON "public"."recipes" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on reminders" ON "public"."reminders" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on routines" ON "public"."routines" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on seasons" ON "public"."seasons" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on snapshots" ON "public"."daily_plan_snapshots" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on stores" ON "public"."stores" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_centers" ON "public"."user_centers" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_created_food_minerals" ON "public"."user_created_food_minerals" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_created_food_vitamins" ON "public"."user_created_food_vitamins" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_day_meals" ON "public"."user_day_meals" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on user_medical_conditions" ON "public"."user_medical_conditions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access to diet preferences" ON "public"."diet_preferences" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access to non preferred foods" ON "public"."non_preferred_foods" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access to preferred foods" ON "public"."preferred_foods" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access to training preferences" ON "public"."training_preferences" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access to user created foods" ON "public"."user_created_foods" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access to user utilities" ON "public"."user_utilities" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin read access on user_medical_conditions" ON "public"."user_medical_conditions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow admin to delete user roles" ON "public"."user_roles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Allow admin to have full access to weight logs" ON "public"."weight_logs" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin to insert user roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin to read all notifications" ON "public"."user_notifications" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow admin to update user roles" ON "public"."user_roles" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Allow admin to view all private_recipe_ingredients" ON "public"."private_recipe_ingredients" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow admin to view all private_recipes" ON "public"."private_recipes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow all to read roles" ON "public"."medical_conditions" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."recipe_utilities" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."roles" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."satiety_levels" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_classification" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_subtypes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."diet_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."fat_classification" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."fat_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_aminogram_properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_aminograms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_carbs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_fats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."food_minerals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."season" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on activity_levels" ON "public"."activity_levels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on aminograms" ON "public"."aminograms" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on antioxidants" ON "public"."antioxidants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on day_meals" ON "public"."day_meals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on diet_goals" ON "public"."diet_goals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on food" ON "public"."food" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on food_antioxidants" ON "public"."food_antioxidants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on food_carb_classification" ON "public"."food_carb_classification" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on food_fat_classification" ON "public"."food_fat_classification" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on food_to_carb_subtypes" ON "public"."food_to_carb_subtypes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on protein_sources" ON "public"."protein_sources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on seasons" ON "public"."seasons" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on stores" ON "public"."stores" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read exercise_muscles" ON "public"."exercise_muscles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read exercises" ON "public"."exercises" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read recipe_ingredients" ON "public"."recipe_ingredients" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read recipe_macros" ON "public"."recipe_macros" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read recipes" ON "public"."recipes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow client to manage their own requests" ON "public"."diet_change_requests" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow coach to read aminograms" ON "public"."aminograms" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read antioxidants" ON "public"."antioxidants" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read carb_types" ON "public"."carb_types" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read fat_types" ON "public"."fat_types" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read food" ON "public"."food" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read food_to_food_groups" ON "public"."food_to_food_groups" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coach to read stores" ON "public"."stores" FOR SELECT USING ("public"."is_admin_or_coach"());



CREATE POLICY "Allow coaches to view their clients profiles" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "profiles"."user_id")))));



CREATE POLICY "Allow only admins to delete profiles" ON "public"."profiles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Allow read access on centers" ON "public"."centers" FOR SELECT USING (true);



CREATE POLICY "Allow read access on user_centers" ON "public"."user_centers" FOR SELECT USING (true);



CREATE POLICY "Allow read access to own profile or any by admin" ON "public"."profiles" FOR SELECT USING (("public"."is_admin"() OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Allow read to all" ON "public"."equipment" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."exercise_joints" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_medical_conditions" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_sensitivities" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_to_food_groups" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_to_macro_roles" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_to_seasons" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_to_stores" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."food_vitamins" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."joints" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."macro_roles" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."minerals" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."muscle_joints" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."muscles" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."recipe_medical_conditions" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."recipe_sensitivities" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."sensitivities" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."utilities" FOR SELECT USING (true);



CREATE POLICY "Allow read to all" ON "public"."vitamins" FOR SELECT USING (true);



CREATE POLICY "Allow reading medical conditions for templates" ON "public"."diet_plan_medical_conditions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("dp"."is_template" = true)))));



CREATE POLICY "Allow reading sensitivities for templates" ON "public"."diet_plan_sensitivities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("dp"."is_template" = true)))));



CREATE POLICY "Allow user to see own role and admin to see all" ON "public"."user_roles" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to access their own mesocycles" ON "public"."mesocycles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to access their own routines" ON "public"."routines" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to delete macros for their own plans" ON "public"."recipe_macros" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to delete recipes for their own plans" ON "public"."diet_plan_recipes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert macros for their own plans" ON "public"."recipe_macros" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert recipes for their own plans" ON "public"."diet_plan_recipes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage medical conditions for their own plans" ON "public"."diet_plan_medical_conditions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage minerals for their own foods" ON "public"."user_created_food_minerals" USING (("auth"."uid"() = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_minerals"."user_created_food_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_minerals"."user_created_food_id"))));



CREATE POLICY "Allow users to manage own sensitivities and admins full access" ON "public"."user_sensitivities" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage sensitivities for their own foods" ON "public"."user_created_food_sensitivities" USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_sensitivities"."user_created_food_id")))) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_sensitivities"."user_created_food_id"))));



CREATE POLICY "Allow users to manage sensitivities for their own plans" ON "public"."diet_plan_sensitivities" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own created foods" ON "public"."user_created_foods" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own day meals" ON "public"."user_day_meals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own diet plan recipe ingredients" ON "public"."diet_plan_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "diet_plan_recipe_ingredients"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own diet plan recipes" ON "public"."diet_plan_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own diet preferences" ON "public"."diet_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own diet_plans" ON "public"."diet_plans" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own equivalence adjustments" ON "public"."equivalence_adjustments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own free meal ingredients" ON "public"."free_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM "public"."free_recipes" "fm"
  WHERE (("fm"."id" = "free_recipe_ingredients"."free_recipe_id") AND ("fm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."free_recipes" "fm"
  WHERE (("fm"."id" = "free_recipe_ingredients"."free_recipe_id") AND ("fm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own free meals" ON "public"."free_recipes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own free recipe occurrences" ON "public"."free_recipe_occurrences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own individual food restrictions" ON "public"."user_individual_food_restrictions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own meal logs" ON "public"."daily_meal_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own non preferred foods" ON "public"."non_preferred_foods" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own notifications" ON "public"."user_notifications" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own planned meals" ON "public"."planned_meals" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own preferred foods" ON "public"."preferred_foods" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own private recipe ingredients" ON "public"."private_recipe_ingredients" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."private_recipes" "pr"
  WHERE (("pr"."id" = "private_recipe_ingredients"."private_recipe_id") AND ("pr"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."private_recipes" "pr"
  WHERE (("pr"."id" = "private_recipe_ingredients"."private_recipe_id") AND ("pr"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Allow users to manage their own private recipes" ON "public"."private_recipes" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own private shopping list items" ON "public"."private_shopping_list_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own shopping list items" ON "public"."shopping_list_items" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own snack ingredients" ON "public"."snack_ingredients" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."snacks" "s"
  WHERE (("s"."id" = "snack_ingredients"."snack_id") AND ("s"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Allow users to manage their own snack logs" ON "public"."daily_snack_logs" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own snack occurrences" ON "public"."snack_occurrences" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own snacks" ON "public"."snacks" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own snapshots" ON "public"."daily_plan_snapshots" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own training preferences" ON "public"."training_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own utilities" ON "public"."user_utilities" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own weight logs" ON "public"."weight_logs" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage vitamins for their own foods" ON "public"."user_created_food_vitamins" USING (("auth"."uid"() = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_vitamins"."user_created_food_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_vitamins"."user_created_food_id"))));



CREATE POLICY "Allow users to see their own advisories" ON "public"."advisories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to update macros for their own plans" ON "public"."recipe_macros" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to view adjustments linked to their equivalences" ON "public"."daily_ingredient_adjustments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."equivalence_adjustments" "ea"
  WHERE (("ea"."id" = "daily_ingredient_adjustments"."equivalence_adjustment_id") AND ("ea"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to view template recipes" ON "public"."diet_plan_recipes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."is_template" = true)))));



CREATE POLICY "Clients can view their coaches" ON "public"."coach_clients" FOR SELECT USING (("auth"."uid"() = "client_id"));



CREATE POLICY "Coaches and Admins can delete recipes" ON "public"."recipes" FOR DELETE USING ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches and Admins can insert recipes" ON "public"."recipes" FOR INSERT WITH CHECK ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches and Admins can update recipes" ON "public"."recipes" FOR UPDATE USING ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches can create center templates" ON "public"."diet_plans" FOR INSERT WITH CHECK ((("is_template" = true) AND ("template_scope" = 'center'::"text") AND ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches can delete client day meals" ON "public"."user_day_meals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_day_meals"."user_id")))));



CREATE POLICY "Coaches can delete client meal logs" ON "public"."daily_meal_logs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_meal_logs"."user_id")))));



CREATE POLICY "Coaches can delete client snack logs" ON "public"."daily_snack_logs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_snack_logs"."user_id")))));



CREATE POLICY "Coaches can delete own center templates" ON "public"."diet_plans" FOR DELETE USING ((("is_template" = true) AND ("template_scope" = 'center'::"text") AND ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches can delete reminders for their clients" ON "public"."reminders" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "reminders"."user_id")))));



CREATE POLICY "Coaches can delete their clients diet plans" ON "public"."diet_plans" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_plans"."user_id")))));



CREATE POLICY "Coaches can insert client day meals" ON "public"."user_day_meals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_day_meals"."user_id")))));



CREATE POLICY "Coaches can insert client meal logs" ON "public"."daily_meal_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_meal_logs"."user_id")))));



CREATE POLICY "Coaches can insert client snack logs" ON "public"."daily_snack_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_snack_logs"."user_id")))));



CREATE POLICY "Coaches can insert diet plans for their clients" ON "public"."diet_plans" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_plans"."user_id")))));



CREATE POLICY "Coaches can insert global templates" ON "public"."diet_plans" FOR INSERT WITH CHECK ((("is_template" = true) AND ("template_scope" = 'global'::"text") AND ("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text")))) AND ("center_id" IS NULL)));



CREATE POLICY "Coaches can insert reminders for their clients" ON "public"."reminders" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "reminders"."user_id")))));



CREATE POLICY "Coaches can manage calorie overrides for clients" ON "public"."diet_plan_calorie_overrides" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."client_id" = "diet_plan_calorie_overrides"."user_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage client equivalence adjustments" ON "public"."equivalence_adjustments" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "equivalence_adjustments"."user_id")))));



CREATE POLICY "Coaches can manage client free recipe ingredients" ON "public"."free_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."free_recipes" "fr"
     JOIN "public"."coach_clients" "cc" ON (("fr"."user_id" = "cc"."client_id")))
  WHERE (("fr"."id" = "free_recipe_ingredients"."free_recipe_id") AND ("cc"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage client free recipe occurrences" ON "public"."free_recipe_occurrences" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "free_recipe_occurrences"."user_id")))));



CREATE POLICY "Coaches can manage client free recipes" ON "public"."free_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "free_recipes"."user_id")))));



CREATE POLICY "Coaches can manage client private recipe ingredients" ON "public"."private_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."private_recipes" "pr"
     JOIN "public"."coach_clients" "cc" ON (("pr"."user_id" = "cc"."client_id")))
  WHERE (("pr"."id" = "private_recipe_ingredients"."private_recipe_id") AND ("cc"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage client private recipes" ON "public"."private_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "private_recipes"."user_id")))));



CREATE POLICY "Coaches can manage client snack ingredients" ON "public"."snack_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."snacks" "s"
     JOIN "public"."coach_clients" "cc" ON (("s"."user_id" = "cc"."client_id")))
  WHERE (("s"."id" = "snack_ingredients"."snack_id") AND ("cc"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage client snack occurrences" ON "public"."snack_occurrences" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "snack_occurrences"."user_id")))));



CREATE POLICY "Coaches can manage client snacks" ON "public"."snacks" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "snacks"."user_id")))));



CREATE POLICY "Coaches can manage conditions in their own templates" ON "public"."diet_plan_medical_conditions" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage diet plan ingredients for clients" ON "public"."diet_plan_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM (("public"."diet_plan_recipes"
     JOIN "public"."diet_plans" ON (("diet_plan_recipes"."diet_plan_id" = "diet_plans"."id")))
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plan_recipes"."id" = "diet_plan_recipe_ingredients"."diet_plan_recipe_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage diet plan medical conditions for clients" ON "public"."diet_plan_medical_conditions" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plans"
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plans"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage diet plan recipes" ON "public"."diet_plan_recipes" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches can manage diet plan recipes for clients" ON "public"."diet_plan_recipes" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plans"
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plans"."id" = "diet_plan_recipes"."diet_plan_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage diet plan sensitivities for clients" ON "public"."diet_plan_sensitivities" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plans"
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plans"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage diet preferences for clients" ON "public"."diet_preferences" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_preferences"."user_id")))));



CREATE POLICY "Coaches can manage global recipe macros" ON "public"."recipe_macros" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches can manage ingredients in their own templates" ON "public"."diet_plan_recipe_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "diet_plan_recipe_ingredients"."diet_plan_recipe_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage macros in their own templates" ON "public"."recipe_macros" USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage medical conditions for clients" ON "public"."user_medical_conditions" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_medical_conditions"."user_id")))));



CREATE POLICY "Coaches can manage non preferred foods for clients" ON "public"."non_preferred_foods" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "non_preferred_foods"."user_id")))));



CREATE POLICY "Coaches can manage preferred foods for clients" ON "public"."preferred_foods" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "preferred_foods"."user_id")))));



CREATE POLICY "Coaches can manage recipe ingredients" ON "public"."recipe_ingredients" USING ("public"."is_admin_or_coach"());



CREATE POLICY "Coaches can manage recipe macros for clients" ON "public"."recipe_macros" USING ((EXISTS ( SELECT 1
   FROM (("public"."diet_plan_recipes"
     JOIN "public"."diet_plans" ON (("diet_plan_recipes"."diet_plan_id" = "diet_plans"."id")))
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plan_recipes"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("coach_clients"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage recipes in their own templates" ON "public"."diet_plan_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage sensitivities for clients" ON "public"."user_sensitivities" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_sensitivities"."user_id")))));



CREATE POLICY "Coaches can manage sensitivities in their own templates" ON "public"."diet_plan_sensitivities" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



CREATE POLICY "Coaches can manage training preferences for clients" ON "public"."training_preferences" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "training_preferences"."user_id")))));



CREATE POLICY "Coaches can manage weight logs for clients" ON "public"."weight_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "weight_logs"."user_id")))));



CREATE POLICY "Coaches can select reminders for their clients" ON "public"."reminders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "reminders"."user_id")))));



CREATE POLICY "Coaches can update client day meals" ON "public"."user_day_meals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_day_meals"."user_id")))));



CREATE POLICY "Coaches can update client meal logs" ON "public"."daily_meal_logs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_meal_logs"."user_id")))));



CREATE POLICY "Coaches can update client snack logs" ON "public"."daily_snack_logs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_snack_logs"."user_id")))));



CREATE POLICY "Coaches can update diet change requests for clients" ON "public"."diet_change_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_change_requests"."user_id")))));



CREATE POLICY "Coaches can update own center templates" ON "public"."diet_plans" FOR UPDATE USING ((("is_template" = true) AND ("template_scope" = 'center'::"text") AND ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text")))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Coaches can update reminders for their clients" ON "public"."reminders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "reminders"."user_id")))));



CREATE POLICY "Coaches can update their clients diet plans" ON "public"."diet_plans" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_plans"."user_id")))));



CREATE POLICY "Coaches can view client created foods" ON "public"."user_created_foods" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_created_foods"."user_id")))));



CREATE POLICY "Coaches can view client day meals" ON "public"."user_day_meals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_day_meals"."user_id")))));



CREATE POLICY "Coaches can view client utilities" ON "public"."user_utilities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "user_utilities"."user_id")))));



CREATE POLICY "Coaches can view diet change requests for clients" ON "public"."diet_change_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_change_requests"."user_id")))));



CREATE POLICY "Coaches can view their clients" ON "public"."coach_clients" FOR SELECT USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can view their clients advisories" ON "public"."advisories" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "advisories"."user_id")))));



CREATE POLICY "Coaches can view their clients diet plans" ON "public"."diet_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "diet_plans"."user_id")))));



CREATE POLICY "Coaches can view their clients meal logs" ON "public"."daily_meal_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_meal_logs"."user_id")))));



CREATE POLICY "Coaches can view their clients snack logs" ON "public"."daily_snack_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "daily_snack_logs"."user_id")))));



CREATE POLICY "Coaches can view their clients weight logs" ON "public"."weight_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "weight_logs"."user_id")))));



CREATE POLICY "Coaches can view their clients workouts" ON "public"."workouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "workouts"."user_id")))));



CREATE POLICY "Coaches create center templates" ON "public"."diet_plans" FOR INSERT WITH CHECK ((("is_template" = true) AND ("template_scope" = 'center'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_centers" "uc"
  WHERE (("uc"."user_id" = "auth"."uid"()) AND ("uc"."center_id" = "diet_plans"."center_id")))) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches delete own templates" ON "public"."diet_plans" FOR DELETE USING ((("is_template" = true) AND ("created_by" = "auth"."uid"()) AND ("template_scope" = 'global'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches manage own templates" ON "public"."diet_plans" FOR UPDATE USING ((("is_template" = true) AND ("created_by" = "auth"."uid"()) AND ("template_scope" = 'global'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches view assigned centers" ON "public"."diet_plan_centers" FOR SELECT USING (true);



CREATE POLICY "Coaches view templates" ON "public"."diet_plans" FOR SELECT USING (((("is_template" = true) AND ("template_scope" = 'global'::"text")) OR (("is_template" = true) AND ("template_scope" = 'center'::"text") AND ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"())))) OR (("is_template" = true) AND ("created_by" = "auth"."uid"()))));



CREATE POLICY "User can create linked food groups for own food" ON "public"."user_created_food_to_food_groups" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "user_created_foods"."user_id"
   FROM "public"."user_created_foods"
  WHERE ("user_created_foods"."id" = "user_created_food_to_food_groups"."user_created_food_id"))));



CREATE POLICY "User or admin can delete conditions" ON "public"."user_medical_conditions" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role_id" = 1))))));



CREATE POLICY "User or admin can insert conditions" ON "public"."user_medical_conditions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role_id" = 1))))));



CREATE POLICY "User or admin can update conditions" ON "public"."user_medical_conditions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role_id" = 1))))));



CREATE POLICY "User or admin can view linked food groups" ON "public"."user_created_food_to_food_groups" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_created_foods" "f"
  WHERE (("f"."id" = "user_created_food_to_food_groups"."user_created_food_id") AND (("f"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_id" = 1)))))))));



CREATE POLICY "Users can manage own assignment progress" ON "public"."assignment_progress" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own calorie overrides" ON "public"."diet_plan_calorie_overrides" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view appropriate templates" ON "public"."diet_plans" FOR SELECT USING ((("is_template" = true) AND (("template_scope" = 'global'::"text") OR ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view medical conditions for their own diet plans" ON "public"."diet_plan_medical_conditions" FOR SELECT TO "authenticated" USING (("diet_plan_id" IN ( SELECT "diet_plans"."id"
   FROM "public"."diet_plans"
  WHERE ("diet_plans"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own diet plan sensitivities" ON "public"."diet_plan_sensitivities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own medical conditions" ON "public"."diet_plan_medical_conditions" FOR SELECT TO "authenticated" USING (("diet_plan_id" IN ( SELECT "diet_plans"."id"
   FROM "public"."diet_plans"
  WHERE ("diet_plans"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own medical conditions" ON "public"."user_medical_conditions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_full_access_delete_on_snack_occurrences" ON "public"."snack_occurrences" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_full_access_insert_on_snack_occurrences" ON "public"."snack_occurrences" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_full_access_on_snack_ingredients" ON "public"."snack_ingredients" TO "authenticated" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_full_access_select_on_snack_occurrences" ON "public"."snack_occurrences" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_full_access_update_on_snack_occurrences" ON "public"."snack_occurrences" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text"));



ALTER TABLE "public"."advisories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aminograms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."antioxidants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carb_classification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carb_subtypes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carb_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_ingredient_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_meal_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_plan_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_snack_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_calorie_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equivalence_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_joints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_muscles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fat_classification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fat_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_aminogram_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_aminograms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_antioxidants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_carb_classification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_carbs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_fat_classification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_fats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_minerals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_carb_subtypes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_food_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_macro_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_vitamins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."free_recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."free_recipe_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."free_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."joints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."macro_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mesocycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."minerals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muscle_joints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muscles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."non_preferred_foods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_adherence_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_adherence_logs_insert_own" ON "public"."plan_adherence_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "plan_adherence_logs_select_own" ON "public"."plan_adherence_logs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "plan_adherence_logs_update_own" ON "public"."plan_adherence_logs" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."planned_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preferred_foods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."private_shopping_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "profiles"."user_id"))))));



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE USING (("public"."is_admin"() OR ("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "profiles"."user_id"))))));



ALTER TABLE "public"."protein_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_macros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_utilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."satiety_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."season" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snack_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snack_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_created_food_minerals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_created_food_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_created_food_to_food_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_created_food_vitamins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_created_foods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_day_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_individual_food_restrictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_utilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vitamins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weight_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workouts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_default_role_client"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_default_role_client"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_default_role_client"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_diet_plan_recipe_ingredients"("_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_diet_plan_recipe_ingredients"("_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_diet_plan_recipe_ingredients"("_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_private_recipe_ingredients"("_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_private_recipe_ingredients"("_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_private_recipe_ingredients"("_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_template_id" bigint, "p_client_id" "uuid", "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_template_id" bigint, "p_client_id" "uuid", "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_template_id" bigint, "p_client_id" "uuid", "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_client_id" "uuid", "p_template_id" bigint, "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_client_id" "uuid", "p_template_id" bigint, "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_template"("p_client_id" "uuid", "p_template_id" bigint, "p_new_plan_name" "text", "p_new_start_date" "date", "p_new_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."clone_diet_plan_with_restrictions"("template_id" bigint, "client_id" "uuid", "new_plan_name" "text", "new_start_date" "date", "new_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_with_restrictions"("template_id" bigint, "client_id" "uuid", "new_plan_name" "text", "new_start_date" "date", "new_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clone_diet_plan_with_restrictions"("template_id" bigint, "client_id" "uuid", "new_plan_name" "text", "new_start_date" "date", "new_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_diet_plan_with_dependencies"("p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_diet_plan_with_dependencies"("p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_diet_plan_with_dependencies"("p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_food"("p_food_name" "text", "p_food_group" "text", "p_state" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_food"("p_food_name" "text", "p_food_group" "text", "p_state" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_food"("p_food_name" "text", "p_food_group" "text", "p_state" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_plan_items"("p_user_id" "uuid", "p_plan_id" bigint, "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_plan_items"("p_user_id" "uuid", "p_plan_id" bigint, "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_plan_items"("p_user_id" "uuid", "p_plan_id" bigint, "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_plan_recipes_with_ingredients"("p_plan_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_plan_recipes_with_ingredients"("p_plan_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_plan_recipes_with_ingredients"("p_plan_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_restrictions"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "anon";
GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"("_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"("_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_balance_macros"("_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_equivalence_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_equivalence_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_equivalence_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_food_total_carbs"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_food_total_carbs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_food_total_carbs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_food_total_carbs"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_food_total_carbs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_food_total_carbs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "service_role";



GRANT ALL ON TABLE "public"."activity_levels" TO "anon";
GRANT ALL ON TABLE "public"."activity_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."advisories" TO "anon";
GRANT ALL ON TABLE "public"."advisories" TO "authenticated";
GRANT ALL ON TABLE "public"."advisories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."advisories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."advisories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."advisories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."aminograms" TO "anon";
GRANT ALL ON TABLE "public"."aminograms" TO "authenticated";
GRANT ALL ON TABLE "public"."aminograms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."aminograms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."aminograms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."aminograms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."antioxidants" TO "anon";
GRANT ALL ON TABLE "public"."antioxidants" TO "authenticated";
GRANT ALL ON TABLE "public"."antioxidants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."antioxidants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."antioxidants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."antioxidants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_progress" TO "anon";
GRANT ALL ON TABLE "public"."assignment_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_progress" TO "service_role";



GRANT ALL ON TABLE "public"."carb_classification" TO "anon";
GRANT ALL ON TABLE "public"."carb_classification" TO "authenticated";
GRANT ALL ON TABLE "public"."carb_classification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."carb_classification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."carb_classification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."carb_classification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."carb_subtypes" TO "anon";
GRANT ALL ON TABLE "public"."carb_subtypes" TO "authenticated";
GRANT ALL ON TABLE "public"."carb_subtypes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."carb_subtypes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."carb_subtypes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."carb_subtypes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."carb_types" TO "anon";
GRANT ALL ON TABLE "public"."carb_types" TO "authenticated";
GRANT ALL ON TABLE "public"."carb_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."carb_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."carb_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."carb_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."centers" TO "anon";
GRANT ALL ON TABLE "public"."centers" TO "authenticated";
GRANT ALL ON TABLE "public"."centers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."centers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."centers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."centers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_clients" TO "anon";
GRANT ALL ON TABLE "public"."coach_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_clients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_clients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_ingredient_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."daily_ingredient_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_ingredient_adjustments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_ingredient_adjustments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_ingredient_adjustments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_ingredient_adjustments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_meal_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_meal_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_meal_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_meal_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_meal_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_meal_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_plan_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."daily_plan_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_plan_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_plan_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_plan_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_plan_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_snack_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_snack_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_snack_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_snack_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_snack_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_snack_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."day_meals" TO "anon";
GRANT ALL ON TABLE "public"."day_meals" TO "authenticated";
GRANT ALL ON TABLE "public"."day_meals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."day_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."day_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."day_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."diet_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_change_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_change_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_change_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_change_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_goals" TO "anon";
GRANT ALL ON TABLE "public"."diet_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_goals" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_calorie_overrides" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_calorie_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_calorie_overrides" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_plan_calorie_overrides_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_plan_calorie_overrides_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_plan_calorie_overrides_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_centers" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_centers" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_plan_recipe_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_plan_recipe_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_plan_recipe_ingredients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_recipes" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_recipes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_plan_recipes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_plan_recipes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_plan_recipes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plans" TO "anon";
GRANT ALL ON TABLE "public"."diet_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_plans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."diet_preferences" TO "anon";
GRANT ALL ON TABLE "public"."diet_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."diet_types" TO "anon";
GRANT ALL ON TABLE "public"."diet_types" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diet_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diet_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diet_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equipment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equipment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equipment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."equivalence_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."equivalence_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."equivalence_adjustments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."equivalence_adjustments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."equivalence_adjustments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."equivalence_adjustments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_joints" TO "anon";
GRANT ALL ON TABLE "public"."exercise_joints" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_joints" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_muscles" TO "anon";
GRANT ALL ON TABLE "public"."exercise_muscles" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_muscles" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_sets" TO "anon";
GRANT ALL ON TABLE "public"."exercise_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_sets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercise_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exercise_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercise_sets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fat_classification" TO "anon";
GRANT ALL ON TABLE "public"."fat_classification" TO "authenticated";
GRANT ALL ON TABLE "public"."fat_classification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fat_classification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fat_classification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fat_classification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fat_types" TO "anon";
GRANT ALL ON TABLE "public"."fat_types" TO "authenticated";
GRANT ALL ON TABLE "public"."fat_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fat_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fat_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fat_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food" TO "anon";
GRANT ALL ON TABLE "public"."food" TO "authenticated";
GRANT ALL ON TABLE "public"."food" TO "service_role";



GRANT ALL ON TABLE "public"."food_aminogram_properties" TO "anon";
GRANT ALL ON TABLE "public"."food_aminogram_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."food_aminogram_properties" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_aminogram_properties_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_aminogram_properties_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_aminogram_properties_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_aminograms" TO "anon";
GRANT ALL ON TABLE "public"."food_aminograms" TO "authenticated";
GRANT ALL ON TABLE "public"."food_aminograms" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_aminograms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_aminograms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_aminograms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_antioxidants" TO "anon";
GRANT ALL ON TABLE "public"."food_antioxidants" TO "authenticated";
GRANT ALL ON TABLE "public"."food_antioxidants" TO "service_role";



GRANT ALL ON TABLE "public"."food_carb_classification" TO "anon";
GRANT ALL ON TABLE "public"."food_carb_classification" TO "authenticated";
GRANT ALL ON TABLE "public"."food_carb_classification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_carb_classification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_carb_classification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_carb_classification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_carbs" TO "anon";
GRANT ALL ON TABLE "public"."food_carbs" TO "authenticated";
GRANT ALL ON TABLE "public"."food_carbs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_carbs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_carbs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_carbs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_fat_classification" TO "anon";
GRANT ALL ON TABLE "public"."food_fat_classification" TO "authenticated";
GRANT ALL ON TABLE "public"."food_fat_classification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_fat_classification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_fat_classification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_fat_classification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_fats" TO "anon";
GRANT ALL ON TABLE "public"."food_fats" TO "authenticated";
GRANT ALL ON TABLE "public"."food_fats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_fats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_fats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_fats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_groups" TO "anon";
GRANT ALL ON TABLE "public"."food_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."food_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_groups_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."food_medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."food_medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."food_minerals" TO "anon";
GRANT ALL ON TABLE "public"."food_minerals" TO "authenticated";
GRANT ALL ON TABLE "public"."food_minerals" TO "service_role";



GRANT ALL ON TABLE "public"."food_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."food_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."food_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."food_to_carb_subtypes" TO "anon";
GRANT ALL ON TABLE "public"."food_to_carb_subtypes" TO "authenticated";
GRANT ALL ON TABLE "public"."food_to_carb_subtypes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_to_carb_subtypes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_to_carb_subtypes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_to_carb_subtypes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_to_food_groups" TO "anon";
GRANT ALL ON TABLE "public"."food_to_food_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."food_to_food_groups" TO "service_role";



GRANT ALL ON TABLE "public"."food_to_macro_roles" TO "anon";
GRANT ALL ON TABLE "public"."food_to_macro_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."food_to_macro_roles" TO "service_role";



GRANT ALL ON TABLE "public"."food_to_seasons" TO "anon";
GRANT ALL ON TABLE "public"."food_to_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."food_to_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."food_to_stores" TO "anon";
GRANT ALL ON TABLE "public"."food_to_stores" TO "authenticated";
GRANT ALL ON TABLE "public"."food_to_stores" TO "service_role";



GRANT ALL ON TABLE "public"."food_vitamins" TO "anon";
GRANT ALL ON TABLE "public"."food_vitamins" TO "authenticated";
GRANT ALL ON TABLE "public"."food_vitamins" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."free_meal_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."free_meal_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."free_meal_ingredients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipes" TO "anon";
GRANT ALL ON TABLE "public"."free_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."free_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."free_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."free_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."joints" TO "anon";
GRANT ALL ON TABLE "public"."joints" TO "authenticated";
GRANT ALL ON TABLE "public"."joints" TO "service_role";



GRANT ALL ON SEQUENCE "public"."joints_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."joints_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."joints_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."macro_roles" TO "anon";
GRANT ALL ON TABLE "public"."macro_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."macro_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."macro_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."macro_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."macro_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_conditions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."medical_conditions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."medical_conditions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."medical_conditions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."mesocycles" TO "anon";
GRANT ALL ON TABLE "public"."mesocycles" TO "authenticated";
GRANT ALL ON TABLE "public"."mesocycles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mesocycles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mesocycles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mesocycles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."minerals" TO "anon";
GRANT ALL ON TABLE "public"."minerals" TO "authenticated";
GRANT ALL ON TABLE "public"."minerals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."minerals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."minerals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."minerals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."muscle_joints" TO "anon";
GRANT ALL ON TABLE "public"."muscle_joints" TO "authenticated";
GRANT ALL ON TABLE "public"."muscle_joints" TO "service_role";



GRANT ALL ON SEQUENCE "public"."muscle_joins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."muscle_joins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."muscle_joins_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."muscles" TO "anon";
GRANT ALL ON TABLE "public"."muscles" TO "authenticated";
GRANT ALL ON TABLE "public"."muscles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."muscles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."muscles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."muscles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."non_preferred_foods" TO "anon";
GRANT ALL ON TABLE "public"."non_preferred_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."non_preferred_foods" TO "service_role";



GRANT ALL ON TABLE "public"."plan_adherence_logs" TO "anon";
GRANT ALL ON TABLE "public"."plan_adherence_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_adherence_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_adherence_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_adherence_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_adherence_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."planned_meals" TO "anon";
GRANT ALL ON TABLE "public"."planned_meals" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_meals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."planned_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."planned_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."planned_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."preferred_foods" TO "anon";
GRANT ALL ON TABLE "public"."preferred_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."preferred_foods" TO "service_role";



GRANT ALL ON TABLE "public"."private_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."private_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."private_recipe_ingredients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."private_recipe_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."private_recipe_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."private_recipe_ingredients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."private_recipes" TO "anon";
GRANT ALL ON TABLE "public"."private_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."private_recipes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."private_recipes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."private_recipes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."private_recipes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."private_shopping_list_items" TO "anon";
GRANT ALL ON TABLE "public"."private_shopping_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."private_shopping_list_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."private_shopping_list_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."private_shopping_list_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."private_shopping_list_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."protein_sources" TO "anon";
GRANT ALL ON TABLE "public"."protein_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."protein_sources" TO "service_role";



GRANT ALL ON SEQUENCE "public"."protein_sources_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."protein_sources_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."protein_sources_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_macros" TO "anon";
GRANT ALL ON TABLE "public"."recipe_macros" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_macros" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recipe_macros_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recipe_macros_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recipe_macros_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."recipe_medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."recipe_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_utilities" TO "anon";
GRANT ALL ON TABLE "public"."recipe_utilities" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_utilities" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recipes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recipes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recipes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reminders" TO "anon";
GRANT ALL ON TABLE "public"."reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reminders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reminders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reminders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."routines" TO "anon";
GRANT ALL ON TABLE "public"."routines" TO "authenticated";
GRANT ALL ON TABLE "public"."routines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."routines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."routines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."routines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."satiety_levels" TO "anon";
GRANT ALL ON TABLE "public"."satiety_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."satiety_levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."satiety_levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."satiety_levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."satiety_levels_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."season" TO "anon";
GRANT ALL ON TABLE "public"."season" TO "authenticated";
GRANT ALL ON TABLE "public"."season" TO "service_role";



GRANT ALL ON SEQUENCE "public"."season_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."season_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."season_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."seasons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."seasons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."seasons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."sensitivities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sensitivities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sensitivities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sensitivities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_list_items" TO "anon";
GRANT ALL ON TABLE "public"."shopping_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shopping_list_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."snack_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."snack_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."snack_ingredients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."snack_ingredients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snack_ingredients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snack_ingredients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."snack_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."snack_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."snack_occurrences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."snack_occurrences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snack_occurrences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snack_occurrences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."snacks" TO "anon";
GRANT ALL ON TABLE "public"."snacks" TO "authenticated";
GRANT ALL ON TABLE "public"."snacks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."snacks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snacks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snacks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."training_preferences" TO "anon";
GRANT ALL ON TABLE "public"."training_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."training_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_centers" TO "anon";
GRANT ALL ON TABLE "public"."user_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_centers" TO "service_role";



GRANT ALL ON TABLE "public"."user_created_food_minerals" TO "anon";
GRANT ALL ON TABLE "public"."user_created_food_minerals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_created_food_minerals" TO "service_role";



GRANT ALL ON TABLE "public"."user_created_food_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."user_created_food_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_created_food_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."user_created_food_to_food_groups" TO "anon";
GRANT ALL ON TABLE "public"."user_created_food_to_food_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."user_created_food_to_food_groups" TO "service_role";



GRANT ALL ON TABLE "public"."user_created_food_vitamins" TO "anon";
GRANT ALL ON TABLE "public"."user_created_food_vitamins" TO "authenticated";
GRANT ALL ON TABLE "public"."user_created_food_vitamins" TO "service_role";



GRANT ALL ON TABLE "public"."user_created_foods" TO "anon";
GRANT ALL ON TABLE "public"."user_created_foods" TO "authenticated";
GRANT ALL ON TABLE "public"."user_created_foods" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_created_foods_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_created_foods_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_created_foods_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_day_meals" TO "anon";
GRANT ALL ON TABLE "public"."user_day_meals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_day_meals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_individual_food_restrictions" TO "anon";
GRANT ALL ON TABLE "public"."user_individual_food_restrictions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_individual_food_restrictions" TO "service_role";



GRANT ALL ON TABLE "public"."user_medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."user_medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."user_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."user_utilities" TO "anon";
GRANT ALL ON TABLE "public"."user_utilities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_utilities" TO "service_role";



GRANT ALL ON TABLE "public"."utilities" TO "anon";
GRANT ALL ON TABLE "public"."utilities" TO "authenticated";
GRANT ALL ON TABLE "public"."utilities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."utilities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."utilities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."utilities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vitamins" TO "anon";
GRANT ALL ON TABLE "public"."vitamins" TO "authenticated";
GRANT ALL ON TABLE "public"."vitamins" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vitamins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vitamins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vitamins_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."weight_logs" TO "anon";
GRANT ALL ON TABLE "public"."weight_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."weight_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."weight_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."weight_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."weight_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."workout_exercises" TO "anon";
GRANT ALL ON TABLE "public"."workout_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_exercises" TO "service_role";



GRANT ALL ON SEQUENCE "public"."workout_exercises_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."workout_exercises_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."workout_exercises_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."workouts" TO "anon";
GRANT ALL ON TABLE "public"."workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."workouts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."workouts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."workouts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."workouts_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







