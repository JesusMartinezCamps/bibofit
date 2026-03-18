


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



CREATE OR REPLACE FUNCTION "public"."_trig_dpri_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM recipe_ingredients WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."_trig_dpri_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_dpri_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO recipe_ingredients (diet_plan_recipe_id, food_id, grams, created_at)
  VALUES (
    NEW.diet_plan_recipe_id,
    NEW.food_id,
    COALESCE(NEW.grams, 0),
    COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_dpri_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_dpri_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE recipe_ingredients
  SET food_id = NEW.food_id, grams = COALESCE(NEW.grams, 0)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_dpri_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_fri_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM recipe_ingredients WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."_trig_fri_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_fri_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO recipe_ingredients (free_recipe_id, food_id, grams, status, created_at)
  VALUES (
    NEW.free_recipe_id,
    NEW.food_id,   -- puede ser NULL para ingredientes pendientes
    COALESCE(NEW.grams, 0),
    COALESCE(NEW.status, 'linked'),
    COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_fri_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_fri_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE recipe_ingredients
  SET food_id = NEW.food_id,
      grams   = COALESCE(NEW.grams, 0),
      status  = COALESCE(NEW.status, 'linked')
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_fri_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_pri_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM recipe_ingredients WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."_trig_pri_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_pri_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO recipe_ingredients (private_recipe_id, food_id, grams)
  VALUES (NEW.private_recipe_id, NEW.food_id, COALESCE(NEW.grams, 0));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_pri_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_trig_pri_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE recipe_ingredients
  SET food_id = NEW.food_id, grams = COALESCE(NEW.grams, 0)
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_trig_pri_update"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."admin_issue_invitation_link"("p_destination" "text" DEFAULT 'signup'::"text", "p_role_id" integer DEFAULT NULL::integer, "p_center_id" bigint DEFAULT NULL::bigint, "p_max_uses" integer DEFAULT 1, "p_note" "text" DEFAULT NULL::"text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "issued_token" "text", "token_preview" "text", "destination" "text", "role_id" integer, "center_id" bigint, "max_uses" integer, "used_uses" integer, "note" "text", "expires_at" timestamp with time zone, "is_revoked" boolean, "revoked_at" timestamp with time zone, "revoked_by" "uuid", "created_by" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "last_used_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_now timestamptz := now();
  v_role_name text;
  v_issued_token text;
  v_token_hash text;
  v_invitation public.invitation_links;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create invitation links.';
  END IF;

  IF COALESCE(trim(p_destination), '') NOT IN ('login', 'signup') THEN
    RAISE EXCEPTION 'Unsupported destination: %', p_destination;
  END IF;

  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role is required.';
  END IF;

  SELECT lower(r.role)
  INTO v_role_name
  FROM public.roles r
  WHERE r.id = p_role_id;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', p_role_id;
  END IF;

  -- Explicit allow-list to prevent future sensitive roles from being assignable by mistake.
  IF v_role_name NOT IN (
    'free',
    'pro-nutrition',
    'pro-workout',
    'coach-nutrition',
    'coach-workout'
  ) THEN
    RAISE EXCEPTION 'Invitations cannot assign this role: %', v_role_name;
  END IF;

  IF p_center_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.centers c WHERE c.id = p_center_id
  ) THEN
    RAISE EXCEPTION 'Center not found: %', p_center_id;
  END IF;

  IF p_max_uses IS NOT NULL AND p_max_uses <= 0 THEN
    RAISE EXCEPTION 'max_uses must be greater than 0 when present.';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= v_now THEN
    RAISE EXCEPTION 'Expiration must be in the future.';
  END IF;

  LOOP
    v_issued_token := lower(replace(gen_random_uuid()::text, '-', ''))
      || substr(lower(replace(gen_random_uuid()::text, '-', '')), 1, 8);
    v_token_hash := public.hash_invitation_token(v_issued_token);
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.invitation_links il
      WHERE il.token = v_token_hash
    );
  END LOOP;

  INSERT INTO public.invitation_links (
    token,
    token_preview,
    destination,
    role_id,
    center_id,
    max_uses,
    note,
    expires_at,
    created_by
  )
  VALUES (
    v_token_hash,
    left(v_issued_token, 6) || '...' || right(v_issued_token, 4),
    COALESCE(NULLIF(trim(p_destination), ''), 'signup'),
    p_role_id,
    p_center_id,
    p_max_uses,
    NULLIF(trim(p_note), ''),
    p_expires_at,
    auth.uid()
  )
  RETURNING * INTO v_invitation;

  RETURN QUERY SELECT
    v_invitation.id,
    v_issued_token,
    v_invitation.token_preview,
    v_invitation.destination,
    v_invitation.role_id,
    v_invitation.center_id,
    v_invitation.max_uses,
    v_invitation.used_uses,
    v_invitation.note,
    v_invitation.expires_at,
    v_invitation.is_revoked,
    v_invitation.revoked_at,
    v_invitation.revoked_by,
    v_invitation.created_by,
    v_invitation.created_at,
    v_invitation.updated_at,
    v_invitation.last_used_at;
END;
$$;


ALTER FUNCTION "public"."admin_issue_invitation_link"("p_destination" "text", "p_role_id" integer, "p_center_id" bigint, "p_max_uses" integer, "p_note" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."invitation_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "destination" "text" DEFAULT 'login'::"text" NOT NULL,
    "role_id" integer NOT NULL,
    "center_id" bigint,
    "max_uses" integer,
    "used_uses" integer DEFAULT 0 NOT NULL,
    "note" "text",
    "expires_at" timestamp with time zone,
    "is_revoked" boolean DEFAULT false NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "token_preview" "text" NOT NULL,
    CONSTRAINT "invitation_links_destination_check" CHECK (("destination" = ANY (ARRAY['login'::"text", 'signup'::"text"]))),
    CONSTRAINT "invitation_links_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0))),
    CONSTRAINT "invitation_links_revocation_consistency_check" CHECK (((("is_revoked" = false) AND ("revoked_at" IS NULL) AND ("revoked_by" IS NULL)) OR (("is_revoked" = true) AND ("revoked_at" IS NOT NULL)))),
    CONSTRAINT "invitation_links_token_hash_check" CHECK (("token" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "invitation_links_usage_bounds_check" CHECK ((("max_uses" IS NULL) OR ("used_uses" <= "max_uses"))),
    CONSTRAINT "invitation_links_used_uses_check" CHECK (("used_uses" >= 0))
);


ALTER TABLE "public"."invitation_links" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revoke_invitation_link"("p_invitation_link_id" "uuid") RETURNS "public"."invitation_links"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invitation public.invitation_links;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke invitation links.';
  END IF;

  UPDATE public.invitation_links il
  SET
    is_revoked = true,
    revoked_at = COALESCE(il.revoked_at, now()),
    revoked_by = COALESCE(il.revoked_by, auth.uid())
  WHERE il.id = p_invitation_link_id
  RETURNING * INTO v_invitation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation link not found: %', p_invitation_link_id;
  END IF;

  RETURN v_invitation;
END;
$$;


ALTER FUNCTION "public"."admin_revoke_invitation_link"("p_invitation_link_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_user_subscription"("p_user_id" "uuid", "p_plan_id" bigint, "p_status" "text" DEFAULT 'active'::"text", "p_source" "text" DEFAULT 'manual'::"text", "p_is_complimentary" boolean DEFAULT true, "p_amount_paid" numeric DEFAULT NULL::numeric, "p_currency" "text" DEFAULT 'EUR'::"text", "p_starts_at" timestamp with time zone DEFAULT "now"(), "p_ends_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_sync_role" boolean DEFAULT true) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_sub_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage subscriptions';
  end if;

  insert into public.user_subscriptions (
    user_id,
    plan_id,
    status,
    source,
    is_complimentary,
    amount_paid,
    currency,
    starts_at,
    ends_at,
    notes,
    assigned_by
  ) values (
    p_user_id,
    p_plan_id,
    p_status,
    p_source,
    p_is_complimentary,
    p_amount_paid,
    coalesce(p_currency, 'EUR'),
    coalesce(p_starts_at, now()),
    p_ends_at,
    p_notes,
    auth.uid()
  )
  returning id into v_sub_id;

  if p_sync_role then
    perform public.sync_user_role_from_subscription(p_user_id);
  end if;

  return v_sub_id;
end;
$$;


ALTER FUNCTION "public"."admin_upsert_user_subscription"("p_user_id" "uuid", "p_plan_id" bigint, "p_status" "text", "p_source" "text", "p_is_complimentary" boolean, "p_amount_paid" numeric, "p_currency" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_notes" "text", "p_sync_role" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_day_meal_id bigint;
  v_diet_plan_id bigint;
  v_original_recipe_style_id bigint;
  v_recipe_style_id bigint;
  new_recipe_id bigint;
  new_diet_plan_recipe_id bigint;
  ingredient_record jsonb;
  occurrence_record record;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can perform this action';
  END IF;

  SELECT user_id, diet_plan_id, day_meal_id, recipe_style_id
  INTO v_user_id, v_diet_plan_id, v_day_meal_id, v_original_recipe_style_id
  FROM user_recipes
  WHERE id = p_free_recipe_id;

  v_recipe_style_id := NULLIF(p_recipe_data->>'recipe_style_id', '')::bigint;
  IF v_recipe_style_id IS NULL THEN
    v_recipe_style_id := v_original_recipe_style_id;
  END IF;

  INSERT INTO recipes (name, instructions, prep_time_min, difficulty, recipe_style_id, created_by)
  VALUES (
    p_recipe_data->>'name',
    p_recipe_data->>'instructions',
    (p_recipe_data->>'prep_time_min')::integer,
    p_recipe_data->>'difficulty',
    v_recipe_style_id,
    auth.uid()
  )
  RETURNING id INTO new_recipe_id;

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

  IF v_diet_plan_id IS NOT NULL THEN
    INSERT INTO diet_plan_recipes (
      diet_plan_id, recipe_id, day_meal_id, is_customized,
      custom_name, custom_instructions, custom_prep_time_min, custom_difficulty
    )
    VALUES (
      v_diet_plan_id, new_recipe_id, v_day_meal_id, true,
      p_recipe_data->>'name',
      p_recipe_data->>'instructions',
      (p_recipe_data->>'prep_time_min')::integer,
      p_recipe_data->>'difficulty'
    )
    RETURNING id INTO new_diet_plan_recipe_id;

    FOR ingredient_record IN SELECT * FROM jsonb_array_elements(p_ingredients)
    LOOP
      INSERT INTO recipe_ingredients (diet_plan_recipe_id, food_id, grams)
      VALUES (
        new_diet_plan_recipe_id,
        (ingredient_record->>'food_id')::bigint,
        (ingredient_record->>'grams')::integer
      );
    END LOOP;

    FOR occurrence_record IN
      SELECT id FROM free_recipe_occurrences WHERE user_recipe_id = p_free_recipe_id
    LOOP
      UPDATE daily_meal_logs
      SET
        diet_plan_recipe_id = new_diet_plan_recipe_id,
        free_recipe_occurrence_id = NULL
      WHERE free_recipe_occurrence_id = occurrence_record.id;
    END LOOP;

    UPDATE equivalence_adjustments
    SET
      source_diet_plan_recipe_id = new_diet_plan_recipe_id,
      source_user_recipe_id = NULL
    WHERE source_user_recipe_id = p_free_recipe_id;

    DELETE FROM free_recipe_occurrences WHERE user_recipe_id = p_free_recipe_id;
    DELETE FROM recipe_ingredients WHERE user_recipe_id = p_free_recipe_id;
    UPDATE user_recipes SET source_user_recipe_id = NULL WHERE source_user_recipe_id = p_free_recipe_id;
    DELETE FROM user_recipes WHERE id = p_free_recipe_id;

    RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', true);
  ELSE
    RETURN jsonb_build_object('success', true, 'recipeId', new_recipe_id, 'addedToPlan', false, 'reason', 'No diet plan ID found on free recipe');
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_diet_plan_recipe"("p_recipe_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_user_id  uuid;
  v_is_admin       boolean;
  v_is_coach       boolean;
  v_active_variants integer;
BEGIN
  SELECT dp.user_id INTO v_owner_user_id
  FROM public.diet_plan_recipes dpr
  JOIN public.diet_plans dp ON dp.id = dpr.diet_plan_id
  WHERE dpr.id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'diet_plan_recipe not found: %', p_recipe_id;
  END IF;

  v_is_admin := public.is_admin();
  v_is_coach := EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.role = 'coach'
  );

  IF NOT v_is_admin THEN
    IF v_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Only admins can archive template plan recipes.';
    END IF;
    IF auth.uid() IS DISTINCT FROM v_owner_user_id THEN
      IF NOT v_is_coach OR NOT EXISTS (
        SELECT 1 FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid() AND cc.client_id = v_owner_user_id
      ) THEN
        RAISE EXCEPTION 'Permission denied to archive this diet plan recipe.';
      END IF;
    END IF;
  END IF;

  -- Contar variantes activas de usuario para devolver al front (informativo, no bloquea)
  SELECT COUNT(*) INTO v_active_variants
  FROM public.user_recipes
  WHERE source_diet_plan_recipe_id = p_recipe_id
    AND is_archived = false;

  UPDATE public.diet_plan_recipes
  SET is_archived = true,
      archived_at = now()
  WHERE id = p_recipe_id;

  RETURN jsonb_build_object('archived_id', p_recipe_id, 'active_variants_count', v_active_variants);
END;
$$;


ALTER FUNCTION "public"."archive_diet_plan_recipe"("p_recipe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_user_recipe"("p_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_user_id uuid;
BEGIN
  SELECT user_id INTO v_owner_user_id
  FROM public.user_recipes
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_recipe not found: %', p_recipe_id;
  END IF;

  IF auth.uid() IS DISTINCT FROM v_owner_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only the owner or an admin can archive recipe %', p_recipe_id;
  END IF;

  UPDATE public.user_recipes
  SET is_archived = true,
      archived_at = now()
  WHERE id = p_recipe_id;
END;
$$;


ALTER FUNCTION "public"."archive_user_recipe"("p_recipe_id" bigint) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comm_conversations c
    WHERE c.id = p_conv_id
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.comm_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = auth.uid()
        )
        OR (c.broadcast_scope = 'all' AND auth.uid() IS NOT NULL)
        OR (c.broadcast_scope = 'coaches' AND public.is_admin_or_coach())
        OR (c.broadcast_scope = 'clients'
            AND NOT public.is_admin_or_coach()
            AND auth.uid() IS NOT NULL)
        OR (c.broadcast_scope = 'coach_clients'
            AND EXISTS (
              SELECT 1 FROM public.coach_clients cc
              WHERE cc.coach_id  = c.created_by
                AND cc.client_id = auth.uid()
            ))
      )
  )
$$;


ALTER FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comm_conversations c
    WHERE c.id = p_conv_id
      AND (
        public.is_admin()
        OR (
          c.is_archived = false
          AND (
            (c.type = 'channel' AND c.created_by = auth.uid())
            OR (
              c.type IN ('direct', 'group')
              AND EXISTS (
                SELECT 1
                FROM public.comm_participants cp
                WHERE cp.conversation_id = c.id
                  AND cp.user_id = auth.uid()
                  AND cp.participant_role IN ('owner', 'member')
              )
            )
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_broadcast_scope" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validar permisos según scope
  IF p_broadcast_scope IN ('all', 'coaches', 'clients') THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo el admin puede crear canales globales (scope: %)', p_broadcast_scope;
    END IF;
  END IF;

  IF p_broadcast_scope = 'coach_clients' THEN
    IF NOT public.is_admin_or_coach() THEN
      RAISE EXCEPTION 'Solo admins y coaches pueden crear canales para sus clientes';
    END IF;
  END IF;

  -- Crear la conversación tipo canal
  INSERT INTO public.comm_conversations (type, name, description, created_by, broadcast_scope)
  VALUES ('channel', p_name, p_description, v_caller_id, p_broadcast_scope)
  RETURNING id INTO v_conversation_id;

  -- El creador es siempre 'owner'
  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  VALUES (v_conversation_id, v_caller_id, 'owner');

  -- Si es canal de clientes del coach, inscribir a todos sus clientes actuales
  IF p_broadcast_scope = 'coach_clients' THEN
    INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
    SELECT v_conversation_id, cc.client_id, 'readonly'
    FROM public.coach_clients cc
    WHERE cc.coach_id = v_caller_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") IS 'Crea un canal de novedades. broadcast_scope: all | coaches | clients | coach_clients | NULL';



CREATE OR REPLACE FUNCTION "public"."comm_get_or_create_admin_convo"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_admin_id UUID;
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Encontrar el primer admin disponible
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found in the system';
  END IF;

  IF v_caller_id = v_admin_id THEN
    RAISE EXCEPTION 'You are the admin';
  END IF;

  -- Reutilizar la función genérica de direct
  RETURN public.comm_get_or_create_direct(v_admin_id);
END;
$$;


ALTER FUNCTION "public"."comm_get_or_create_admin_convo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."comm_get_or_create_admin_convo"() IS 'Crea o devuelve el chat directo entre el usuario actual y el admin del sistema';



CREATE OR REPLACE FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_conversation_id UUID;
  v_user_a          TEXT;
  v_user_b          TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  -- Orden estable para ambos lados del chat y lock de transacción.
  v_user_a := LEAST(v_caller_id::TEXT, p_other_user_id::TEXT);
  v_user_b := GREATEST(v_caller_id::TEXT, p_other_user_id::TEXT);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_a || ':' || v_user_b, 0));

  -- Re-check tras lock para evitar duplicados por carrera.
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM public.comm_participants cp1
  JOIN public.comm_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN public.comm_conversations c
    ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_caller_id
    AND cp2.user_id = p_other_user_id
    AND c.type = 'direct'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.comm_conversations (type, created_by)
  VALUES ('direct', v_caller_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  VALUES
    (v_conversation_id, v_caller_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member');

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") IS 'Crea o devuelve la conversación directa entre el usuario actual y p_other_user_id';



CREATE OR REPLACE FUNCTION "public"."comm_get_unread_total"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(SUM(t.unread_count), 0)::INTEGER
  FROM public.comm_list_conversations() t;
$$;


ALTER FUNCTION "public"."comm_get_unread_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_guard_messages_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only is_deleted and edited_at can be updated in comm_messages';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."comm_guard_messages_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_guard_participants_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.participant_role IS DISTINCT FROM OLD.participant_role
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'Only last_read_at and is_muted can be updated in comm_participants';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."comm_guard_participants_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_list_conversations"() RETURNS TABLE("id" "uuid", "type" "text", "name" "text", "description" "text", "broadcast_scope" "text", "updated_at" timestamp with time zone, "created_by" "uuid", "my_role" "text", "last_read_at" timestamp with time zone, "unread_count" integer, "other_user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH visible AS (
    SELECT c.id, c.type, c.name, c.description, c.broadcast_scope, c.updated_at, c.created_by
    FROM public.comm_conversations c
    WHERE c.is_archived = false
      AND public.comm_can_read_conversation(c.id)
  ),
  my_part AS (
    SELECT cp.conversation_id, cp.participant_role, cp.last_read_at
    FROM public.comm_participants cp
    WHERE cp.user_id = auth.uid()
  ),
  my_reads AS (
    SELECT cur.conversation_id, cur.last_read_at
    FROM public.comm_user_reads cur
    WHERE cur.user_id = auth.uid()
  )
  SELECT
    v.id,
    v.type,
    v.name,
    v.description,
    v.broadcast_scope,
    v.updated_at,
    v.created_by,
    mp.participant_role AS my_role,
    COALESCE(mp.last_read_at, mr.last_read_at) AS last_read_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.comm_messages m
      WHERE m.conversation_id = v.id
        AND m.is_deleted = false
        AND m.sender_id IS DISTINCT FROM auth.uid()
        AND (
          COALESCE(mp.last_read_at, mr.last_read_at) IS NULL
          OR m.created_at > COALESCE(mp.last_read_at, mr.last_read_at)
        )
    ) AS unread_count,
    CASE
      WHEN v.type = 'direct' THEN (
        SELECT cp2.user_id
        FROM public.comm_participants cp2
        WHERE cp2.conversation_id = v.id
          AND cp2.user_id <> auth.uid()
        ORDER BY cp2.id
        LIMIT 1
      )
      ELSE NULL
    END AS other_user_id
  FROM visible v
  LEFT JOIN my_part mp ON mp.conversation_id = v.id
  LEFT JOIN my_reads mr ON mr.conversation_id = v.id
  ORDER BY v.updated_at DESC;
$$;


ALTER FUNCTION "public"."comm_list_conversations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_list_conversations_v2"() RETURNS TABLE("id" "uuid", "type" "text", "name" "text", "description" "text", "broadcast_scope" "text", "updated_at" timestamp with time zone, "created_by" "uuid", "my_role" "text", "last_read_at" timestamp with time zone, "unread_count" integer, "other_user_id" "uuid", "other_full_name" "text", "other_first_name" "text", "other_last_name" "text", "other_avatar_url" "text", "other_email" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH visible AS (
    SELECT c.id, c.type, c.name, c.description, c.broadcast_scope, c.updated_at, c.created_by
    FROM public.comm_conversations c
    WHERE c.is_archived = false
      AND public.comm_can_read_conversation(c.id)
  ),
  my_part AS (
    SELECT cp.conversation_id, cp.participant_role, cp.last_read_at
    FROM public.comm_participants cp
    WHERE cp.user_id = auth.uid()
  ),
  my_reads AS (
    SELECT cur.conversation_id, cur.last_read_at
    FROM public.comm_user_reads cur
    WHERE cur.user_id = auth.uid()
  )
  SELECT
    v.id,
    v.type,
    v.name,
    v.description,
    v.broadcast_scope,
    v.updated_at,
    v.created_by,
    mp.participant_role AS my_role,
    COALESCE(mp.last_read_at, mr.last_read_at) AS last_read_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.comm_messages m
      WHERE m.conversation_id = v.id
        AND m.is_deleted = false
        AND m.sender_id IS DISTINCT FROM auth.uid()
        AND (
          COALESCE(mp.last_read_at, mr.last_read_at) IS NULL
          OR m.created_at > COALESCE(mp.last_read_at, mr.last_read_at)
        )
    ) AS unread_count,
    ou.other_user_id,
    p.full_name AS other_full_name,
    p.first_name AS other_first_name,
    p.last_name AS other_last_name,
    p.avatar_url AS other_avatar_url,
    p.email AS other_email
  FROM visible v
  LEFT JOIN my_part mp ON mp.conversation_id = v.id
  LEFT JOIN my_reads mr ON mr.conversation_id = v.id
  LEFT JOIN LATERAL (
    SELECT cp.user_id AS other_user_id
    FROM public.comm_participants cp
    WHERE cp.conversation_id = v.id
      AND cp.user_id <> auth.uid()
    ORDER BY cp.id
    LIMIT 1
  ) ou ON v.type = 'direct'
  LEFT JOIN public.profiles p ON p.user_id = ou.other_user_id
  ORDER BY v.updated_at DESC;
$$;


ALTER FUNCTION "public"."comm_list_conversations_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_read_at TIMESTAMPTZ := COALESCE(p_read_at, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.comm_can_read_conversation(p_conv_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.comm_participants
  SET last_read_at = GREATEST(COALESCE(last_read_at, 'epoch'::timestamptz), v_read_at)
  WHERE conversation_id = p_conv_id
    AND user_id = v_user_id;

  IF FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.comm_user_reads (conversation_id, user_id, last_read_at, updated_at)
  VALUES (p_conv_id, v_user_id, v_read_at, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_at = GREATEST(public.comm_user_reads.last_read_at, EXCLUDED.last_read_at),
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_rate_limit_messages_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_recent_count
  FROM public.comm_messages m
  WHERE m.sender_id = NEW.sender_id
    AND m.created_at >= (now() - INTERVAL '1 minute');

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 20 messages per minute';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."comm_rate_limit_messages_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  SELECT c.id, NEW.client_id, 'readonly'
  FROM public.comm_conversations c
  WHERE c.created_by  = NEW.coach_id
    AND c.type        = 'channel'
    AND c.broadcast_scope = 'coach_clients'
    AND c.is_archived = false
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM public.comm_participants cp
  USING public.comm_conversations c
  WHERE cp.conversation_id  = c.id
    AND cp.user_id           = OLD.client_id
    AND cp.participant_role  = 'readonly'
    AND c.created_by         = OLD.coach_id
    AND c.type               = 'channel'
    AND c.broadcast_scope    = 'coach_clients';
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_trig_update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.comm_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."comm_trig_update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_diet_plan_id bigint;
  v_day_meal_id bigint;
  new_user_recipe_id bigint;
  occurrence_record record;
  ingredient_record jsonb;
  is_coach boolean;
  is_admin_user boolean;
begin
  is_admin_user := is_admin();
  is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  select user_id, diet_plan_id, day_meal_id
  into v_user_id, v_diet_plan_id, v_day_meal_id
  from user_recipes
  where id = p_free_recipe_id;

  if v_user_id is null then
    raise exception 'Free recipe not found';
  end if;

  if not is_admin_user then
    if is_coach then
      if not exists (select 1 from coach_clients where coach_id = auth.uid() and client_id = v_user_id) then
        raise exception 'Permission denied: Client is not assigned to you.';
      end if;
    else
      raise exception 'Only admins or assigned coaches can perform this action';
    end if;
  end if;

  insert into user_recipes (
    user_id, type, name, instructions, prep_time_min, difficulty,
    diet_plan_id, day_meal_id, source_user_recipe_id
  )
  values (
    v_user_id,
    'private',
    p_new_recipe_data->>'name',
    p_new_recipe_data->>'instructions',
    (p_new_recipe_data->>'prep_time_min')::integer,
    p_new_recipe_data->>'difficulty',
    v_diet_plan_id,
    v_day_meal_id,
    p_free_recipe_id
  )
  returning id into new_user_recipe_id;

  for ingredient_record in select * from jsonb_array_elements(p_new_ingredients)
  loop
    insert into recipe_ingredients (user_recipe_id, food_id, grams)
    values (
      new_user_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric
    );
  end loop;

  for occurrence_record in
    select id from free_recipe_occurrences where user_recipe_id = p_free_recipe_id
  loop
    update daily_meal_logs
    set
      user_recipe_id = new_user_recipe_id,
      free_recipe_occurrence_id = null
    where free_recipe_occurrence_id = occurrence_record.id;
  end loop;

  update equivalence_adjustments
  set source_user_recipe_id = new_user_recipe_id
  where source_user_recipe_id = p_free_recipe_id;

  delete from free_recipe_occurrences where user_recipe_id = p_free_recipe_id;
  delete from recipe_ingredients where user_recipe_id = p_free_recipe_id;
  delete from user_recipes where id = p_free_recipe_id;

  return new_user_recipe_id;
end;
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
declare
  child_id bigint;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select dp.user_id
  into v_owner_user_id
  from public.diet_plan_recipes dpr
  join public.diet_plans dp on dp.id = dpr.diet_plan_id
  where dpr.id = p_recipe_id;

  if not found then
    raise exception 'Diet plan recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if not v_is_admin then
    if v_owner_user_id is null then
      raise exception 'Only admins can delete template plan recipes.';
    end if;

    if auth.uid() is distinct from v_owner_user_id then
      if not v_is_coach or not exists (
        select 1
        from public.coach_clients cc
        where cc.coach_id = auth.uid()
          and cc.client_id = v_owner_user_id
      ) then
        raise exception 'Permission denied to delete this diet plan recipe.';
      end if;
    end if;
  end if;

  for child_id in
    select id
    from public.diet_plan_recipes
    where parent_diet_plan_recipe_id = p_recipe_id
  loop
    perform public.delete_diet_plan_recipe_with_dependencies(child_id);
  end loop;

  delete from public.diet_change_requests
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.daily_meal_logs
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.planned_meals
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.recipe_macros
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.diet_plan_recipe_ingredients
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.equivalence_adjustments
  where source_diet_plan_recipe_id = p_recipe_id;

  delete from public.diet_plan_recipes
  where id = p_recipe_id;
end;
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
begin
  if not is_admin() then
    raise exception 'Only admins can delete food items.';
  end if;

  delete from food_to_food_groups where food_id = p_food_id;
  delete from food_to_macro_roles where food_id = p_food_id;
  delete from food_to_seasons where food_id = p_food_id;
  delete from food_to_stores where food_id = p_food_id;
  delete from food_sensitivities where food_id = p_food_id;
  delete from food_medical_conditions where food_id = p_food_id;
  delete from food_antioxidants where food_id = p_food_id;
  delete from food_vitamins where food_id = p_food_id;
  delete from food_minerals where food_id = p_food_id;
  delete from food_aminograms where food_id = p_food_id;
  delete from food_aminogram_properties where food_id = p_food_id;
  delete from food_fats where food_id = p_food_id;
  delete from food_to_carb_subtypes where food_id = p_food_id;
  delete from food_carbs where food_id = p_food_id;
  delete from food_fat_classification where food_id = p_food_id;
  delete from food_carb_classification where food_id = p_food_id;
  delete from recipe_ingredients where food_id = p_food_id;
  delete from diet_plan_recipe_ingredients where food_id = p_food_id;
  delete from daily_ingredient_adjustments where food_id = p_food_id;
  delete from shopping_list_items where food_id = p_food_id;
  delete from snack_ingredients where food_id = p_food_id;
  delete from free_recipe_ingredients where food_id = p_food_id;
  delete from private_recipe_ingredients where food_id = p_food_id;
  delete from user_individual_food_restrictions where food_id = p_food_id;
  delete from preferred_foods where food_id = p_food_id;
  delete from non_preferred_foods where food_id = p_food_id;

  delete from food where id = p_food_id;
end;
$$;


ALTER FUNCTION "public"."delete_food_with_dependencies"("p_food_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  is_coach boolean;
  is_admin_user boolean;
begin
  select user_id into v_user_id from user_recipes where id = p_free_recipe_id;

  if v_user_id is null then
    raise exception 'Free recipe not found';
  end if;

  is_admin_user := is_admin();
  is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() != v_user_id and not is_admin_user then
    if is_coach then
      if not exists (select 1 from coach_clients where coach_id = auth.uid() and client_id = v_user_id) then
        raise exception 'Permission denied to delete this free recipe. Client not assigned.';
      end if;
    else
      raise exception 'Permission denied to delete this free recipe.';
    end if;
  end if;

  delete from equivalence_adjustments
  where source_user_recipe_id = p_free_recipe_id;

  delete from daily_meal_logs
  where free_recipe_occurrence_id in (
    select id from free_recipe_occurrences where user_recipe_id = p_free_recipe_id
  );

  delete from free_recipe_occurrences where user_recipe_id = p_free_recipe_id;
  delete from recipe_ingredients where user_recipe_id = p_free_recipe_id;
  delete from user_recipes where id = p_free_recipe_id;
end;
$$;


ALTER FUNCTION "public"."delete_free_recipe_and_occurrences"("p_free_recipe_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  child_id bigint;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'private';

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to delete this private recipe.';
    end if;
  end if;

  for child_id in
    select id
    from public.user_recipes
    where parent_user_recipe_id = p_recipe_id
      and type = 'private'
  loop
    perform public.delete_private_recipe_cascade(child_id);
  end loop;

  delete from public.diet_change_requests
  where user_recipe_id = p_recipe_id
     or requested_changes_user_recipe_id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  delete from public.daily_meal_logs
  where user_recipe_id = p_recipe_id;

  delete from public.planned_meals
  where user_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where user_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where equivalence_adjustment_id in (
    select id
    from public.equivalence_adjustments
    where source_user_recipe_id = p_recipe_id
  );

  delete from public.equivalence_adjustments
  where source_user_recipe_id = p_recipe_id;

  delete from public.user_recipes
  where id = p_recipe_id;
end;
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
declare
  plan_record record;
  food_record record;
begin
  if not is_admin() then
    raise exception 'Only admins can delete users.';
  end if;

  delete from daily_ingredient_adjustments
  where equivalence_adjustment_id in (
    select id from equivalence_adjustments where user_id = p_user_id
  );

  delete from equivalence_adjustments where user_id = p_user_id;

  for plan_record in select id from diet_plans where user_id = p_user_id loop
    perform delete_diet_plan_with_dependencies(plan_record.id);
  end loop;

  delete from daily_meal_logs where user_id = p_user_id;
  delete from daily_snack_logs where user_id = p_user_id;
  delete from daily_plan_snapshots where user_id = p_user_id;
  delete from plan_adherence_logs where user_id = p_user_id;
  delete from planned_meals where user_id = p_user_id;
  delete from diet_change_requests where user_id = p_user_id;

  delete from free_recipe_occurrences where user_id = p_user_id;
  delete from recipe_ingredients
  where user_recipe_id in (select id from user_recipes where user_id = p_user_id);
  delete from user_recipes where user_id = p_user_id;

  delete from snack_occurrences where user_id = p_user_id;
  delete from snack_ingredients where snack_id in (select id from snacks where user_id = p_user_id);
  delete from snacks where user_id = p_user_id;

  for food_record in select id from food where user_id = p_user_id loop
    perform delete_food_with_dependencies(food_record.id);
  end loop;

  delete from user_day_meals where user_id = p_user_id;
  delete from shopping_list_items where user_id = p_user_id;
  delete from private_shopping_list_items where user_id = p_user_id;
  delete from weight_logs where user_id = p_user_id;
  delete from diet_preferences where user_id = p_user_id;
  delete from training_preferences where user_id = p_user_id;
  delete from user_individual_food_restrictions where user_id = p_user_id;
  delete from user_medical_conditions where user_id = p_user_id;
  delete from user_sensitivities where user_id = p_user_id;
  delete from preferred_foods where user_id = p_user_id;
  delete from non_preferred_foods where user_id = p_user_id;
  delete from user_utilities where user_id = p_user_id;
  delete from user_notifications where user_id = p_user_id;
  delete from advisories where user_id = p_user_id;
  delete from reminders where user_id = p_user_id;

  delete from coach_clients where client_id = p_user_id or coach_id = p_user_id;
  delete from user_centers where user_id = p_user_id;
  delete from user_roles where user_id = p_user_id;

  update diet_plan_centers set assigned_by = null where assigned_by = p_user_id;

  delete from profiles where user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_recipe_variant_if_unused"("p_recipe_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_recipe public.user_recipes%ROWTYPE;
  v_is_admin boolean;
  v_latest_sibling_id bigint;
BEGIN
  SELECT *
  INTO v_recipe
  FROM public.user_recipes
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found: %', p_recipe_id;
  END IF;

  IF v_recipe.type IS DISTINCT FROM 'variant' THEN
    RAISE EXCEPTION 'Only variants can be deleted with this operation.';
  END IF;

  IF v_recipe.is_archived THEN
    RAISE EXCEPTION 'Archived variants cannot be deleted.';
  END IF;

  v_is_admin := public.is_admin();

  IF auth.uid() IS DISTINCT FROM v_recipe.user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied to delete this variant.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.planned_meals pm
    WHERE pm.user_recipe_id = p_recipe_id
  ) OR EXISTS (
    SELECT 1
    FROM public.daily_meal_logs dml
    WHERE dml.user_recipe_id = p_recipe_id
  ) OR EXISTS (
    SELECT 1
    FROM public.free_recipe_occurrences fro
    WHERE fro.user_recipe_id = p_recipe_id
  ) THEN
    RAISE EXCEPTION 'Variant is linked to meals and cannot be deleted.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_recipes child
    WHERE child.parent_user_recipe_id = p_recipe_id
      AND child.is_archived = false
  ) THEN
    RAISE EXCEPTION 'Variant has active children and cannot be deleted.';
  END IF;

  IF v_recipe.parent_user_recipe_id IS NOT NULL THEN
    SELECT sibling.id
    INTO v_latest_sibling_id
    FROM public.user_recipes sibling
    WHERE sibling.parent_user_recipe_id = v_recipe.parent_user_recipe_id
      AND sibling.user_id = v_recipe.user_id
      AND sibling.type = 'variant'
      AND sibling.is_archived = false
    ORDER BY sibling.created_at DESC NULLS LAST, sibling.id DESC
    LIMIT 1;
  ELSIF v_recipe.source_diet_plan_recipe_id IS NOT NULL THEN
    SELECT sibling.id
    INTO v_latest_sibling_id
    FROM public.user_recipes sibling
    WHERE sibling.parent_user_recipe_id IS NULL
      AND sibling.source_diet_plan_recipe_id = v_recipe.source_diet_plan_recipe_id
      AND sibling.user_id = v_recipe.user_id
      AND sibling.diet_plan_id IS NOT DISTINCT FROM v_recipe.diet_plan_id
      AND sibling.type = 'variant'
      AND sibling.is_archived = false
    ORDER BY sibling.created_at DESC NULLS LAST, sibling.id DESC
    LIMIT 1;
  ELSE
    SELECT sibling.id
    INTO v_latest_sibling_id
    FROM public.user_recipes sibling
    WHERE sibling.parent_user_recipe_id IS NULL
      AND sibling.source_diet_plan_recipe_id IS NULL
      AND sibling.user_id = v_recipe.user_id
      AND sibling.diet_plan_id IS NOT DISTINCT FROM v_recipe.diet_plan_id
      AND sibling.type = 'variant'
      AND sibling.is_archived = false
    ORDER BY sibling.created_at DESC NULLS LAST, sibling.id DESC
    LIMIT 1;
  END IF;

  IF v_latest_sibling_id IS NULL OR v_latest_sibling_id <> p_recipe_id THEN
    RAISE EXCEPTION 'Only the latest variant in this list can be deleted.';
  END IF;

  DELETE FROM public.daily_ingredient_adjustments
  WHERE equivalence_adjustment_id IN (
    SELECT ea.id
    FROM public.equivalence_adjustments ea
    WHERE ea.source_user_recipe_id = p_recipe_id
  );

  DELETE FROM public.daily_ingredient_adjustments
  WHERE user_recipe_id = p_recipe_id;

  DELETE FROM public.equivalence_adjustments
  WHERE source_user_recipe_id = p_recipe_id;

  DELETE FROM public.user_recipes
  WHERE id = p_recipe_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_recipe_variant_if_unused"("p_recipe_id" bigint) OWNER TO "postgres";


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
declare
  result jsonb;
begin
  select jsonb_build_object(
    'dietPlanRecipes', (
      select coalesce(jsonb_agg(dpr_agg), '[]'::jsonb)
      from (
        select
          dpr.*,
          r.name as recipe_name,
          r.instructions as recipe_instructions,
          r.prep_time_min as recipe_prep_time,
          r.difficulty as recipe_difficulty,
          (
            select jsonb_agg(jsonb_build_object('food_id', ri.food_id, 'grams', ri.grams))
            from recipe_ingredients ri where ri.recipe_id = dpr.recipe_id
          ) as recipe_ingredients,
          dm.name as day_meal_name
        from diet_plan_recipes dpr
        join recipes r on dpr.recipe_id = r.id
        join day_meals dm on dpr.day_meal_id = dm.id
        where dpr.diet_plan_id = p_plan_id
      ) dpr_agg
    ),
    'privateRecipes', (
      select coalesce(jsonb_agg(ur_agg), '[]'::jsonb)
      from (
        select ur.*
        from user_recipes ur
        where ur.user_id = p_user_id
          and ur.diet_plan_id = p_plan_id
          and ur.type = 'private'
      ) ur_agg
    ),
    'freeMeals', (
      select coalesce(jsonb_agg(fm_agg), '[]'::jsonb)
      from (
        select
          fro.*,
          ur.name,
          ur.instructions,
          ur.prep_time_min,
          ur.difficulty,
          ur.day_meal_id,
          (
            select jsonb_agg(jsonb_build_object('food_id', ri.food_id, 'grams', ri.grams))
            from recipe_ingredients ri
            where ri.user_recipe_id = ur.id
          ) as recipe_ingredients,
          fro.id as occurrence_id
        from free_recipe_occurrences fro
        join user_recipes ur on fro.user_recipe_id = ur.id
        where fro.user_id = p_user_id
          and (ur.diet_plan_id = p_plan_id or ur.diet_plan_id is null)
          and ur.type = 'free'
          and fro.meal_date between p_start_date and p_end_date
      ) fm_agg
    ),
    'mealLogs', (
      select coalesce(jsonb_agg(dml), '[]'::jsonb) from daily_meal_logs dml
      where dml.user_id = p_user_id and dml.log_date between p_start_date and p_end_date
    ),
    'userDayMeals', (
      select coalesce(jsonb_agg(udm_agg), '[]'::jsonb)
      from (
        select udm.*, dm.name as day_meal_name, dm.display_order
        from user_day_meals udm
        join day_meals dm on udm.day_meal_id = dm.id
        where udm.user_id = p_user_id
        order by dm.display_order
      ) udm_agg
    )
  ) into result;

  return result;
end;
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


CREATE OR REPLACE FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") RETURNS TABLE("user_id" "uuid", "full_name" "text", "pending_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    p.user_id,
    p.full_name,
    count(ur.id)::integer as pending_count
  from public.user_recipes ur
  join public.profiles p on ur.user_id = p.user_id
  where ur.type = 'free'
    and ur.status = p_status
  group by p.user_id, p.full_name
  having count(ur.id) > 0
  order by p.full_name;
end;
$$;


ALTER FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_pending_foods_count"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "pending_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    p.user_id,
    p.full_name,
    count(f.id)::integer as pending_count
  from public.food f
  join public.profiles p on f.user_id = p.user_id
  where f.status = 'pending'
    and f.user_id is not null
  group by p.user_id, p.full_name
  having count(f.id) > 0
  order by p.full_name;
end;
$$;


ALTER FUNCTION "public"."get_users_with_pending_foods_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (user_id, first_name, last_name, full_name, email, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone'
  )
  on conflict (user_id) do update
  set
    email      = excluded.email,
    first_name = coalesce(profiles.first_name, excluded.first_name),
    last_name  = coalesce(profiles.last_name,  excluded.last_name),
    phone      = coalesce(profiles.phone,      excluded.phone);

  insert into public.user_roles (user_id, role_id)
  values (new.id, (select id from public.roles where role = 'free'))
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_invitation_token"("p_token" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
  SELECT encode(extensions.digest(lower(trim(p_token)), 'sha256'), 'hex');
$$;


ALTER FUNCTION "public"."hash_invitation_token"("p_token" "text") OWNER TO "postgres";


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
begin
  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid()
      and (
        lower(r.role) = 'admin'
        or public.is_coach_role(r.role)
      )
  );
end;
$$;


ALTER FUNCTION "public"."is_admin_or_coach"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_client_role"("p_role" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select lower(coalesce(p_role, '')) in ('pro-nutrition', 'pro-workout', 'client');
$$;


ALTER FUNCTION "public"."is_client_role"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach_role"("p_role" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select lower(coalesce(p_role, '')) in ('coach-nutrition', 'coach-workout', 'coach');
$$;


ALTER FUNCTION "public"."is_coach_role"("p_role" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."peek_invitation_link"("p_token" "text") RETURNS TABLE("status" "text", "role_name" "text", "center_name" "text", "expires_at" timestamp with time zone, "max_uses" integer, "used_uses" integer, "is_revoked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_now timestamptz := now();
  v_token text := lower(trim(COALESCE(p_token, '')));
  v_token_hash text;
  v_inv public.invitation_links%ROWTYPE;
  v_role text;
  v_center text;
BEGIN
  IF v_token = '' THEN
    RETURN QUERY SELECT
      'missing_token'::text, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, NULL::boolean;
    RETURN;
  END IF;

  IF v_token !~ '^[a-z0-9]{24,96}$' THEN
    RETURN QUERY SELECT
      'invalid_token'::text, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, NULL::boolean;
    RETURN;
  END IF;

  v_token_hash := public.hash_invitation_token(v_token);

  SELECT * INTO v_inv
  FROM public.invitation_links
  WHERE token = v_token_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'invalid_token'::text, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, NULL::boolean;
    RETURN;
  END IF;

  SELECT r.role INTO v_role
  FROM public.roles r
  WHERE r.id = v_inv.role_id;

  SELECT c.name INTO v_center
  FROM public.centers c
  WHERE c.id = v_inv.center_id;

  IF v_inv.is_revoked THEN
    RETURN QUERY SELECT
      'revoked'::text, v_role, v_center,
      v_inv.expires_at, v_inv.max_uses, v_inv.used_uses, v_inv.is_revoked;
    RETURN;
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= v_now THEN
    RETURN QUERY SELECT
      'expired'::text, v_role, v_center,
      v_inv.expires_at, v_inv.max_uses, v_inv.used_uses, v_inv.is_revoked;
    RETURN;
  END IF;

  IF v_inv.max_uses IS NOT NULL AND v_inv.used_uses >= v_inv.max_uses THEN
    RETURN QUERY SELECT
      'exhausted'::text, v_role, v_center,
      v_inv.expires_at, v_inv.max_uses, v_inv.used_uses, v_inv.is_revoked;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    'valid'::text, v_role, v_center,
    v_inv.expires_at, v_inv.max_uses, v_inv.used_uses, v_inv.is_revoked;
END;
$_$;


ALTER FUNCTION "public"."peek_invitation_link"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_invitation_link"("p_token" "text", "p_source" "text" DEFAULT 'web'::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS TABLE("status" "text", "invitation_link_id" "uuid", "role_id" integer, "center_id" bigint, "used_uses" integer, "max_uses" integer, "expires_at" timestamp with time zone, "is_revoked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_now timestamptz := now();
  v_token text := lower(trim(COALESCE(p_token, '')));
  v_token_hash text;
  v_source text := lower(trim(COALESCE(p_source, 'web')));
  v_invitation public.invitation_links%ROWTYPE;
  v_usage_id bigint;
  v_current_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to redeem invitation links.';
  END IF;

  IF v_source NOT IN (
    'web',
    'login_password',
    'signup_auto_session',
    'auth_state_signed_in',
    'session_bootstrap',
    'oauth_google'
  ) THEN
    v_source := 'web';
  END IF;

  IF v_token = '' THEN
    RETURN QUERY SELECT
      'missing_token'::text,
      NULL::uuid,
      NULL::integer,
      NULL::bigint,
      NULL::integer,
      NULL::integer,
      NULL::timestamptz,
      NULL::boolean;
    RETURN;
  END IF;

  IF v_token !~ '^[a-z0-9]{24,96}$' THEN
    RETURN QUERY SELECT
      'invalid_token'::text,
      NULL::uuid,
      NULL::integer,
      NULL::bigint,
      NULL::integer,
      NULL::integer,
      NULL::timestamptz,
      NULL::boolean;
    RETURN;
  END IF;

  v_token_hash := public.hash_invitation_token(v_token);

  SELECT *
  INTO v_invitation
  FROM public.invitation_links il
  WHERE il.token = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'invalid_token'::text,
      NULL::uuid,
      NULL::integer,
      NULL::bigint,
      NULL::integer,
      NULL::integer,
      NULL::timestamptz,
      NULL::boolean;
    RETURN;
  END IF;

  SELECT iu.id
  INTO v_usage_id
  FROM public.invitation_link_usages iu
  WHERE iu.invitation_link_id = v_invitation.id
    AND iu.user_id = auth.uid()
  LIMIT 1;

  IF v_usage_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (auth.uid(), v_invitation.role_id)
    ON CONFLICT (user_id) DO UPDATE
      SET role_id = EXCLUDED.role_id;

    IF v_invitation.center_id IS NULL THEN
      DELETE FROM public.user_centers uc
      WHERE uc.user_id = auth.uid();
    ELSE
      DELETE FROM public.user_centers uc
      WHERE uc.user_id = auth.uid()
        AND uc.center_id IS DISTINCT FROM v_invitation.center_id;

      INSERT INTO public.user_centers (user_id, center_id)
      VALUES (auth.uid(), v_invitation.center_id)
      ON CONFLICT (user_id, center_id) DO NOTHING;
    END IF;

    RETURN QUERY SELECT
      'already_redeemed'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  SELECT lower(r.role)
  INTO v_current_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1;

  IF v_current_role IN ('admin', 'coach', 'coach-nutrition', 'coach-workout') THEN
    RETURN QUERY SELECT
      'forbidden_role'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_current_role IS NOT NULL AND v_current_role <> 'free' THEN
    RETURN QUERY SELECT
      'ineligible_role'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_invitation.is_revoked THEN
    RETURN QUERY SELECT
      'revoked'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= v_now THEN
    RETURN QUERY SELECT
      'expired'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_invitation.max_uses IS NOT NULL AND v_invitation.used_uses >= v_invitation.max_uses THEN
    RETURN QUERY SELECT
      'exhausted'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (auth.uid(), v_invitation.role_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role_id = EXCLUDED.role_id;

  IF v_invitation.center_id IS NULL THEN
    DELETE FROM public.user_centers uc
    WHERE uc.user_id = auth.uid();
  ELSE
    DELETE FROM public.user_centers uc
    WHERE uc.user_id = auth.uid()
      AND uc.center_id IS DISTINCT FROM v_invitation.center_id;

    INSERT INTO public.user_centers (user_id, center_id)
    VALUES (auth.uid(), v_invitation.center_id)
    ON CONFLICT (user_id, center_id) DO NOTHING;
  END IF;

  INSERT INTO public.invitation_link_usages (
    invitation_link_id,
    user_id,
    consumed_at,
    source,
    user_agent,
    assigned_role_id,
    assigned_center_id
  )
  VALUES (
    v_invitation.id,
    auth.uid(),
    v_now,
    v_source,
    left(NULLIF(trim(COALESCE(p_user_agent, '')), ''), 1024),
    v_invitation.role_id,
    v_invitation.center_id
  )
  ON CONFLICT ON CONSTRAINT invitation_link_usages_invitation_link_id_user_id_key DO NOTHING
  RETURNING id INTO v_usage_id;

  IF v_usage_id IS NULL THEN
    RETURN QUERY SELECT
      'already_redeemed'::text,
      v_invitation.id,
      v_invitation.role_id,
      v_invitation.center_id,
      v_invitation.used_uses,
      v_invitation.max_uses,
      v_invitation.expires_at,
      v_invitation.is_revoked;
    RETURN;
  END IF;

  UPDATE public.invitation_links il
  SET
    used_uses = il.used_uses + 1,
    last_used_at = v_now
  WHERE il.id = v_invitation.id
  RETURNING * INTO v_invitation;

  RETURN QUERY SELECT
    'applied'::text,
    v_invitation.id,
    v_invitation.role_id,
    v_invitation.center_id,
    v_invitation.used_uses,
    v_invitation.max_uses,
    v_invitation.expires_at,
    v_invitation.is_revoked;
END;
$_$;


ALTER FUNCTION "public"."redeem_invitation_link"("p_token" "text", "p_source" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_full_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.full_name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_full_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_role_from_subscription"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_nutrition_role_id integer;
  v_workout_role_id integer;
  v_free_role_id integer;
  v_has_active_nutrition_access boolean;
  v_has_active_workout_access boolean;
begin
  select id into v_nutrition_role_id from public.roles where role = 'pro-nutrition' limit 1;
  if v_nutrition_role_id is null then
    select id into v_nutrition_role_id from public.roles where role = 'client' limit 1;
  end if;

  select id into v_workout_role_id from public.roles where role = 'pro-workout' limit 1;
  select id into v_free_role_id from public.roles where role = 'free' limit 1;

  if v_nutrition_role_id is null or v_free_role_id is null then
    raise exception 'Required roles (pro-nutrition/free) are missing in public.roles';
  end if;

  select exists (
    select 1
    from public.user_subscriptions us
    join public.commercial_plan_role_targets rt on rt.plan_id = us.plan_id
    join public.roles r on r.id = rt.role_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and lower(r.role) in ('pro-nutrition', 'client')
  ) into v_has_active_nutrition_access;

  select exists (
    select 1
    from public.user_subscriptions us
    join public.commercial_plan_role_targets rt on rt.plan_id = us.plan_id
    join public.roles r on r.id = rt.role_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and lower(r.role) = 'pro-workout'
  ) into v_has_active_workout_access;

  -- Current schema allows a single role per user (user_roles PK=user_id).
  -- Priority: nutrition > workout > free.
  if v_has_active_nutrition_access then
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_nutrition_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  elsif v_has_active_workout_access and v_workout_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_workout_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  else
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_free_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."sync_user_role_from_subscription"("p_user_id" "uuid") OWNER TO "postgres";


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
declare
  ingredient_record jsonb;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'free';

  if not found then
    raise exception 'Free recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to update this free recipe.';
    end if;
  end if;

  update public.user_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients (user_recipe_id, food_id, grams, status)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric,
      case
        when lower(coalesce(ingredient_record->>'status', '')) = 'pending' then 'pending'
        when lower(coalesce(ingredient_record->>'status', '')) = 'rejected' then 'rejected'
        else 'linked'
      end
    );
  end loop;
end;
$$;


ALTER FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  ingredient_record jsonb;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'private';

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to update this private recipe.';
    end if;
  end if;

  update public.user_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients (user_recipe_id, food_id, grams)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric
    );
  end loop;
end;
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


CREATE OR REPLACE FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_roles" "text"[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and lower(r.role) = any(p_roles)
  );
end;
$$;


ALTER FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


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



CREATE TABLE IF NOT EXISTS "public"."comm_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'direct'::"text" NOT NULL,
    "name" "text",
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "broadcast_scope" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comm_conversations_broadcast_scope_check" CHECK (("broadcast_scope" = ANY (ARRAY['all'::"text", 'coaches'::"text", 'clients'::"text", 'coach_clients'::"text"]))),
    CONSTRAINT "comm_conversations_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'channel'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."comm_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."comm_conversations" IS 'Hilos de conversación del Centro de Comunicaciones';



COMMENT ON COLUMN "public"."comm_conversations"."broadcast_scope" IS 'NULL=participantes explícitos | all=todos | coaches=coaches | clients=clientes | coach_clients=clientes del coach creador';



CREATE TABLE IF NOT EXISTS "public"."comm_messages" (
    "id" bigint NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "body" "text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "metadata" "jsonb",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "comm_messages_body_length_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 2000))),
    CONSTRAINT "comm_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'system'::"text", 'announcement'::"text", 'recipe_share'::"text", 'diet_share'::"text"])))
);


ALTER TABLE "public"."comm_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."comm_messages" IS 'Mensajes del Centro de Comunicaciones';



COMMENT ON COLUMN "public"."comm_messages"."type" IS 'text | system | announcement | recipe_share | diet_share';



COMMENT ON COLUMN "public"."comm_messages"."metadata" IS 'JSON extensible: recipe_id, diet_plan_id, attachment_url, etc.';



ALTER TABLE "public"."comm_messages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comm_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comm_participants" (
    "id" bigint NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "participant_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "is_muted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "comm_participants_role_check" CHECK (("participant_role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'readonly'::"text"])))
);


ALTER TABLE "public"."comm_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."comm_participants" IS 'Participantes explícitos en conversaciones del Communication Center';



COMMENT ON COLUMN "public"."comm_participants"."last_read_at" IS 'Timestamp del último mensaje leído; todo lo posterior cuenta como no leído';



ALTER TABLE "public"."comm_participants" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comm_participants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comm_user_reads" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_user_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commercial_plan_features" (
    "id" bigint NOT NULL,
    "plan_id" bigint NOT NULL,
    "feature_text" "text" NOT NULL,
    "included" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commercial_plan_features" OWNER TO "postgres";


ALTER TABLE "public"."commercial_plan_features" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."commercial_plan_features_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."commercial_plan_role_targets" (
    "plan_id" bigint NOT NULL,
    "role_id" integer NOT NULL
);


ALTER TABLE "public"."commercial_plan_role_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commercial_plans" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subtitle" "text",
    "description" "text",
    "price_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "price_currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "billing_type" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "cta_label" "text" DEFAULT 'Empezar'::"text" NOT NULL,
    "cta_link" "text",
    "is_popular" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "show_on_home" boolean DEFAULT true NOT NULL,
    "show_on_pricing" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_area" "text" DEFAULT 'nutrition'::"text" NOT NULL,
    CONSTRAINT "commercial_plans_billing_type_check" CHECK (("billing_type" = ANY (ARRAY['monthly'::"text", 'one_time'::"text"]))),
    CONSTRAINT "commercial_plans_product_area_check" CHECK (("product_area" = ANY (ARRAY['nutrition'::"text", 'workout'::"text", 'bundle'::"text"])))
);


ALTER TABLE "public"."commercial_plans" OWNER TO "postgres";


ALTER TABLE "public"."commercial_plans" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."commercial_plans_id_seq"
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
    "food_id" bigint NOT NULL,
    "original_grams" numeric NOT NULL,
    "adjusted_grams" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_recipe_id" bigint
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
    "free_recipe_occurrence_id" bigint,
    "user_recipe_id" bigint
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
    "user_recipe_id" bigint,
    "requested_changes_user_recipe_id" bigint,
    CONSTRAINT "check_one_recipe_id" CHECK (((("diet_plan_recipe_id" IS NOT NULL) AND ("user_recipe_id" IS NULL)) OR (("diet_plan_recipe_id" IS NULL) AND ("user_recipe_id" IS NOT NULL)))),
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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "energy_adjustment_direction" "text",
    "default_adjustment_pct" numeric(5,2),
    "min_adjustment_pct" numeric(5,2),
    "max_adjustment_pct" numeric(5,2),
    CONSTRAINT "diet_goals_adjustment_range_check" CHECK (((("min_adjustment_pct" IS NULL) OR (("min_adjustment_pct" >= (0)::numeric) AND ("min_adjustment_pct" <= (100)::numeric))) AND (("max_adjustment_pct" IS NULL) OR (("max_adjustment_pct" >= (0)::numeric) AND ("max_adjustment_pct" <= (100)::numeric))) AND (("default_adjustment_pct" IS NULL) OR (("default_adjustment_pct" >= (0)::numeric) AND ("default_adjustment_pct" <= (100)::numeric))))),
    CONSTRAINT "diet_goals_energy_adjustment_direction_check" CHECK ((("energy_adjustment_direction" IS NULL) OR ("energy_adjustment_direction" = ANY (ARRAY['deficit'::"text", 'maintenance'::"text", 'surplus'::"text"]))))
);


ALTER TABLE "public"."diet_goals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."diet_goals"."energy_adjustment_direction" IS 'Direccion del ajuste calorico por objetivo: deficit, maintenance o surplus.';



COMMENT ON COLUMN "public"."diet_goals"."default_adjustment_pct" IS 'Ajuste calorico porcentual por defecto sugerido para ese objetivo.';



COMMENT ON COLUMN "public"."diet_goals"."min_adjustment_pct" IS 'Limite inferior de ajuste porcentual permitido en onboarding.';



COMMENT ON COLUMN "public"."diet_goals"."max_adjustment_pct" IS 'Limite superior de ajuste porcentual permitido en onboarding.';



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


CREATE TABLE IF NOT EXISTS "public"."recipe_ingredients" (
    "id" bigint NOT NULL,
    "recipe_id" bigint,
    "diet_plan_recipe_id" bigint,
    "food_id" bigint,
    "grams" numeric(10,2) DEFAULT 0 NOT NULL,
    "food_group_id" bigint,
    "status" "text" DEFAULT 'linked'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_recipe_id" bigint,
    "locked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "exactly_one_parent" CHECK (((((("recipe_id" IS NOT NULL))::integer + (("diet_plan_recipe_id" IS NOT NULL))::integer) + (("user_recipe_id" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "recipe_ingredients_new_status_check" CHECK (("status" = ANY (ARRAY['linked'::"text", 'pending'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."recipe_ingredients" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."diet_plan_recipe_ingredients" AS
 SELECT "id",
    "diet_plan_recipe_id",
    "food_id",
    "grams",
    "created_at"
   FROM "public"."recipe_ingredients"
  WHERE ("diet_plan_recipe_id" IS NOT NULL);


ALTER VIEW "public"."diet_plan_recipe_ingredients" OWNER TO "postgres";


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
    "custom_recipe_style_id" bigint,
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
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
    "diet_goal_id" "uuid",
    "calorie_adjustment_direction" "text",
    "calorie_adjustment_pct" numeric(5,2),
    CONSTRAINT "diet_preferences_calorie_adjustment_direction_check" CHECK ((("calorie_adjustment_direction" IS NULL) OR ("calorie_adjustment_direction" = ANY (ARRAY['deficit'::"text", 'maintenance'::"text", 'surplus'::"text"])))),
    CONSTRAINT "diet_preferences_calorie_adjustment_pct_check" CHECK ((("calorie_adjustment_pct" IS NULL) OR (("calorie_adjustment_pct" >= (0)::numeric) AND ("calorie_adjustment_pct" <= (100)::numeric))))
);


ALTER TABLE "public"."diet_preferences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."diet_preferences"."calorie_adjustment_direction" IS 'Direccion elegida por el usuario para ajustar su TDEE: deficit, maintenance o surplus.';



COMMENT ON COLUMN "public"."diet_preferences"."calorie_adjustment_pct" IS 'Magnitud porcentual del ajuste calorico aplicado al TDEE segun el objetivo.';



CREATE TABLE IF NOT EXISTS "public"."diet_type_food_group_rules" (
    "diet_type_id" bigint NOT NULL,
    "food_group_id" bigint NOT NULL,
    "rule_type" "text" NOT NULL,
    CONSTRAINT "diet_type_food_group_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['excluded'::"text", 'limited'::"text"])))
);


ALTER TABLE "public"."diet_type_food_group_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."diet_type_food_group_rules" IS 'Grupos de alimentos incompatibles (excluded) o de uso reducido (limited) por tipo de dieta. Genera advertencias, no bloqueos.';



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
    "source_daily_snack_log_id" bigint,
    "source_diet_plan_recipe_id" bigint,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "error_message" "text",
    "source_free_recipe_occurrence_id" bigint,
    "source_user_recipe_id" bigint
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
    "grams_per_unit" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "visibility" "text" DEFAULT 'global'::"text",
    "moderation_status" "text" DEFAULT 'approved'::"text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "source_user_created_food_id" bigint
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


CREATE TABLE IF NOT EXISTS "public"."food_substitution_mappings" (
    "id" bigint NOT NULL,
    "source_food_id" bigint NOT NULL,
    "target_food_id" bigint NOT NULL,
    "substitution_type" "text" NOT NULL,
    "confidence_score" numeric NOT NULL,
    "reason" "text",
    "is_automatic" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "food_substitution_mappings_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (100)::numeric))),
    CONSTRAINT "food_substitution_mappings_substitution_type_check" CHECK (("substitution_type" = ANY (ARRAY['exact_match'::"text", 'nutritional_equivalent'::"text", 'allergen_safe'::"text"])))
);


ALTER TABLE "public"."food_substitution_mappings" OWNER TO "postgres";


ALTER TABLE "public"."food_substitution_mappings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."food_substitution_mappings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."user_recipes" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'free'::"text" NOT NULL,
    "name" "text",
    "instructions" "text",
    "day_meal_id" bigint,
    "diet_plan_id" bigint,
    "prep_time_min" integer,
    "difficulty" "text",
    "status" "text",
    "parent_user_recipe_id" bigint,
    "parent_recipe_id" bigint,
    "source_user_recipe_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "recipe_style_id" bigint,
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "source_diet_plan_recipe_id" bigint,
    "variant_label" "text",
    "diff_summary" "jsonb",
    CONSTRAINT "user_recipes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved_private'::"text", 'approved_general'::"text", 'kept_as_free_recipe'::"text", 'rejected'::"text"]))),
    CONSTRAINT "user_recipes_type_check" CHECK (("type" = ANY (ARRAY['free'::"text", 'private'::"text", 'variant'::"text"])))
);


ALTER TABLE "public"."user_recipes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."free_recipe_ingredients" AS
 SELECT "ri"."id",
    "ri"."user_recipe_id" AS "free_recipe_id",
    "ri"."food_id",
    "ri"."grams",
    "ri"."status",
    "ri"."created_at"
   FROM ("public"."recipe_ingredients" "ri"
     JOIN "public"."user_recipes" "ur" ON (("ur"."id" = "ri"."user_recipe_id")))
  WHERE ("ur"."type" = 'free'::"text");


ALTER VIEW "public"."free_recipe_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."free_recipe_occurrences" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "meal_date" "date" NOT NULL,
    "day_meal_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_recipe_id" bigint
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



CREATE OR REPLACE VIEW "public"."free_recipes" AS
 SELECT "id",
    "user_id",
    "created_at",
    "day_meal_id",
    "name",
    "instructions",
    "status",
    "diet_plan_id",
    "prep_time_min",
    "difficulty",
    "parent_user_recipe_id" AS "parent_free_recipe_id",
    "parent_recipe_id",
    "source_user_recipe_id" AS "source_free_recipe_id",
    "recipe_style_id"
   FROM "public"."user_recipes"
  WHERE ("type" = 'free'::"text");


ALTER VIEW "public"."free_recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_link_usages" (
    "id" bigint NOT NULL,
    "invitation_link_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consumed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "user_agent" "text",
    "assigned_role_id" integer NOT NULL,
    "assigned_center_id" bigint,
    CONSTRAINT "invitation_link_usages_source_check" CHECK (("source" = ANY (ARRAY['web'::"text", 'login_password'::"text", 'signup_auto_session'::"text", 'auth_state_signed_in'::"text", 'session_bootstrap'::"text", 'oauth_google'::"text"])))
);


ALTER TABLE "public"."invitation_link_usages" OWNER TO "postgres";


ALTER TABLE "public"."invitation_link_usages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."invitation_link_usages_id_seq"
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
    "day_meal_id" bigint NOT NULL,
    "plan_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_recipe_id" bigint,
    CONSTRAINT "chk_one_meal_type" CHECK (((("diet_plan_recipe_id" IS NOT NULL) AND ("user_recipe_id" IS NULL)) OR (("diet_plan_recipe_id" IS NULL) AND ("user_recipe_id" IS NOT NULL))))
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


CREATE OR REPLACE VIEW "public"."private_recipe_ingredients" AS
 SELECT "ri"."id",
    "ri"."user_recipe_id" AS "private_recipe_id",
    "ri"."food_id",
    "ri"."grams",
    "ri"."created_at"
   FROM ("public"."recipe_ingredients" "ri"
     JOIN "public"."user_recipes" "ur" ON (("ur"."id" = "ri"."user_recipe_id")))
  WHERE ("ur"."type" = 'private'::"text");


ALTER VIEW "public"."private_recipe_ingredients" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."private_recipes" AS
 SELECT "id",
    "user_id",
    "source_user_recipe_id" AS "source_free_recipe_id",
    "name",
    "instructions",
    "created_at",
    "diet_plan_id",
    "day_meal_id",
    "prep_time_min",
    "difficulty",
    "parent_user_recipe_id" AS "parent_private_recipe_id",
    "recipe_style_id"
   FROM "public"."user_recipes"
  WHERE ("type" = 'private'::"text");


ALTER VIEW "public"."private_recipes" OWNER TO "postgres";


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
    "has_seen_quick_guide" boolean DEFAULT false,
    "first_name" "text",
    "last_name" "text",
    "avatar_url" "text",
    "preferred_theme" "text",
    "knows_ffm" boolean,
    "ffm_method" "text",
    "is_athlete" boolean,
    "athlete_type" "text",
    "ffm_pct" numeric(5,2),
    "fm_pct" numeric(5,2),
    "ffm_kg" numeric(6,2),
    "fm_kg" numeric(6,2),
    "ger_equation_key" "text",
    CONSTRAINT "profiles_athlete_type_check" CHECK ((("athlete_type" IS NULL) OR ("athlete_type" = ANY (ARRAY['Physique'::"text", 'Sport'::"text", 'Both'::"text"])))),
    CONSTRAINT "profiles_ffm_method_check" CHECK ((("ffm_method" IS NULL) OR ("ffm_method" = ANY (ARRAY['Skinfold'::"text", 'DXA'::"text", 'UWW'::"text", 'BIA'::"text"])))),
    CONSTRAINT "profiles_phone_e164_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+[1-9]\d{6,14}$'::"text"))),
    CONSTRAINT "profiles_preferred_theme_check" CHECK (("preferred_theme" = ANY (ARRAY['light'::"text", 'dark'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."knows_ffm" IS 'Indica si el usuario conoce su masa libre de grasa (FFM/MLG).';



COMMENT ON COLUMN "public"."profiles"."ffm_method" IS 'Método de estimación de FFM: Skinfold, DXA, UWW o BIA.';



COMMENT ON COLUMN "public"."profiles"."is_athlete" IS 'Indica si el usuario se considera atleta para seleccionar ecuaciones energéticas.';



COMMENT ON COLUMN "public"."profiles"."athlete_type" IS 'Tipo de atleta: Physique, Sport o Both (ambos enfoques).';



COMMENT ON COLUMN "public"."profiles"."ffm_pct" IS 'Porcentaje de masa libre de grasa (MLG).';



COMMENT ON COLUMN "public"."profiles"."fm_pct" IS 'Porcentaje de masa grasa (MG).';



COMMENT ON COLUMN "public"."profiles"."ffm_kg" IS 'Masa libre de grasa (kg).';



COMMENT ON COLUMN "public"."profiles"."fm_kg" IS 'Masa grasa (kg).';



COMMENT ON COLUMN "public"."profiles"."ger_equation_key" IS 'Clave de la ecuación utilizada para calcular el GER.';



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



ALTER TABLE "public"."recipe_ingredients" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."recipe_ingredients_new_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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


CREATE TABLE IF NOT EXISTS "public"."recipe_styles" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recipe_styles" OWNER TO "postgres";


ALTER TABLE "public"."recipe_styles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."recipe_styles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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
    "image_url" "text",
    "recipe_style_id" bigint
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
    "role" "text",
    "description" "text"
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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
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



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


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



ALTER TABLE "public"."user_recipes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_recipes_id_seq"
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



CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" bigint NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "is_complimentary" boolean DEFAULT false NOT NULL,
    "amount_paid" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "notes" "text",
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_subscriptions_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'stripe'::"text", 'coach'::"text"]))),
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'expired'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


ALTER TABLE "public"."user_subscriptions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



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



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_participants"
    ADD CONSTRAINT "comm_participants_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."comm_participants"
    ADD CONSTRAINT "comm_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_user_reads"
    ADD CONSTRAINT "comm_user_reads_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."commercial_plan_features"
    ADD CONSTRAINT "commercial_plan_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commercial_plan_role_targets"
    ADD CONSTRAINT "commercial_plan_role_targets_pkey" PRIMARY KEY ("plan_id", "role_id");



ALTER TABLE ONLY "public"."commercial_plans"
    ADD CONSTRAINT "commercial_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commercial_plans"
    ADD CONSTRAINT "commercial_plans_slug_key" UNIQUE ("slug");



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



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "diet_plan_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_plan_sensitivities"
    ADD CONSTRAINT "diet_plan_sensitivities_pkey" PRIMARY KEY ("diet_plan_id", "sensitivity_id");



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "diet_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."diet_type_food_group_rules"
    ADD CONSTRAINT "diet_type_food_group_rules_pkey" PRIMARY KEY ("diet_type_id", "food_group_id");



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



ALTER TABLE ONLY "public"."food_substitution_mappings"
    ADD CONSTRAINT "food_substitution_mappings_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_invitation_link_id_user_id_key" UNIQUE ("invitation_link_id", "user_id");



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_token_key" UNIQUE ("token");



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
    ADD CONSTRAINT "recipe_ingredients_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_macros"
    ADD CONSTRAINT "recipe_macros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_medical_conditions"
    ADD CONSTRAINT "recipe_medical_conditions_pkey" PRIMARY KEY ("recipe_id", "condition_id");



ALTER TABLE ONLY "public"."recipe_sensitivities"
    ADD CONSTRAINT "recipe_sensitivities_pkey" PRIMARY KEY ("recipe_id", "sensitivity_id");



ALTER TABLE ONLY "public"."recipe_styles"
    ADD CONSTRAINT "recipe_styles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."recipe_styles"
    ADD CONSTRAINT "recipe_styles_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



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



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_pkey" PRIMARY KEY ("user_id", "condition_id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_pkey" PRIMARY KEY ("user_id", "sensitivity_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "comm_messages_conversation_created_idx" ON "public"."comm_messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "comm_messages_sender_created_idx" ON "public"."comm_messages" USING "btree" ("sender_id", "created_at" DESC) WHERE ("sender_id" IS NOT NULL);



CREATE INDEX "comm_messages_sender_id_idx" ON "public"."comm_messages" USING "btree" ("sender_id");



CREATE INDEX "comm_participants_conversation_id_idx" ON "public"."comm_participants" USING "btree" ("conversation_id");



CREATE INDEX "comm_participants_user_id_idx" ON "public"."comm_participants" USING "btree" ("user_id");



CREATE INDEX "comm_user_reads_user_id_idx" ON "public"."comm_user_reads" USING "btree" ("user_id");



CREATE INDEX "idx_carb_subtypes_classification_id" ON "public"."carb_subtypes" USING "btree" ("classification_id");



CREATE INDEX "idx_commercial_plan_features_plan_sort" ON "public"."commercial_plan_features" USING "btree" ("plan_id", "sort_order", "id");



CREATE INDEX "idx_commercial_plans_active_sort" ON "public"."commercial_plans" USING "btree" ("is_active", "sort_order", "id");



CREATE INDEX "idx_commercial_plans_product_area_active_sort" ON "public"."commercial_plans" USING "btree" ("product_area", "is_active", "sort_order", "id");



CREATE INDEX "idx_diet_plan_calorie_overrides_user_id" ON "public"."diet_plan_calorie_overrides" USING "btree" ("user_id");



CREATE INDEX "idx_diet_plan_calorie_overrides_user_plan" ON "public"."diet_plan_calorie_overrides" USING "btree" ("user_id", "diet_plan_id");



CREATE INDEX "idx_diet_plan_recipes_custom_recipe_style_id" ON "public"."diet_plan_recipes" USING "btree" ("custom_recipe_style_id");



CREATE INDEX "idx_dpr_is_archived" ON "public"."diet_plan_recipes" USING "btree" ("is_archived");



CREATE INDEX "idx_food_source_user_created_food_id" ON "public"."food" USING "btree" ("source_user_created_food_id");



CREATE INDEX "idx_food_status" ON "public"."food" USING "btree" ("status");



CREATE INDEX "idx_food_substitution_confidence" ON "public"."food_substitution_mappings" USING "btree" ("confidence_score" DESC);



CREATE INDEX "idx_food_substitution_source" ON "public"."food_substitution_mappings" USING "btree" ("source_food_id");



CREATE UNIQUE INDEX "idx_food_substitution_source_target_context_key" ON "public"."food_substitution_mappings" USING "btree" ("source_food_id", "target_food_id", COALESCE(NULLIF(("metadata" ->> 'context_key'::"text"), ''::"text"), 'general'::"text"));



CREATE INDEX "idx_food_substitution_target" ON "public"."food_substitution_mappings" USING "btree" ("target_food_id");



CREATE INDEX "idx_food_user_id" ON "public"."food" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_has_seen_quick_guide" ON "public"."profiles" USING "btree" ("has_seen_quick_guide");



CREATE INDEX "idx_profiles_profile_type" ON "public"."profiles" USING "btree" ("profile_type");



CREATE INDEX "idx_recipe_macros_diet_plan_recipe_id" ON "public"."recipe_macros" USING "btree" ("diet_plan_recipe_id");



CREATE INDEX "idx_recipe_macros_recipe_id" ON "public"."recipe_macros" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipes_recipe_style_id" ON "public"."recipes" USING "btree" ("recipe_style_id");



CREATE INDEX "idx_ri_diet_plan_recipe_id" ON "public"."recipe_ingredients" USING "btree" ("diet_plan_recipe_id") WHERE ("diet_plan_recipe_id" IS NOT NULL);



CREATE INDEX "idx_ri_food_id" ON "public"."recipe_ingredients" USING "btree" ("food_id");



CREATE INDEX "idx_ri_recipe_id" ON "public"."recipe_ingredients" USING "btree" ("recipe_id") WHERE ("recipe_id" IS NOT NULL);



CREATE INDEX "idx_ri_user_recipe_id" ON "public"."recipe_ingredients" USING "btree" ("user_recipe_id") WHERE ("user_recipe_id" IS NOT NULL);



CREATE INDEX "idx_ur_is_archived" ON "public"."user_recipes" USING "btree" ("is_archived");



CREATE INDEX "idx_ur_source_diet_plan_recipe_id" ON "public"."user_recipes" USING "btree" ("source_diet_plan_recipe_id") WHERE ("source_diet_plan_recipe_id" IS NOT NULL);



CREATE INDEX "idx_user_recipes_recipe_style_id" ON "public"."user_recipes" USING "btree" ("recipe_style_id");



CREATE INDEX "idx_user_recipes_status" ON "public"."user_recipes" USING "btree" ("status") WHERE ("status" IS NOT NULL);



CREATE INDEX "idx_user_recipes_type" ON "public"."user_recipes" USING "btree" ("type");



CREATE INDEX "idx_user_recipes_user_id" ON "public"."user_recipes" USING "btree" ("user_id");



CREATE INDEX "idx_user_subscriptions_plan" ON "public"."user_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_user_subscriptions_user_status" ON "public"."user_subscriptions" USING "btree" ("user_id", "status", "starts_at" DESC);



CREATE INDEX "invitation_link_usages_invitation_id_idx" ON "public"."invitation_link_usages" USING "btree" ("invitation_link_id", "consumed_at" DESC);



CREATE INDEX "invitation_link_usages_user_id_idx" ON "public"."invitation_link_usages" USING "btree" ("user_id", "consumed_at" DESC);



CREATE INDEX "invitation_links_active_idx" ON "public"."invitation_links" USING "btree" ("is_revoked", "expires_at", "created_at" DESC);



CREATE INDEX "invitation_links_created_at_idx" ON "public"."invitation_links" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "user_day_meals_base_unique_idx" ON "public"."user_day_meals" USING "btree" ("user_id", "day_meal_id") WHERE ("diet_plan_id" IS NULL);



CREATE UNIQUE INDEX "user_day_meals_plan_unique_idx" ON "public"."user_day_meals" USING "btree" ("user_id", "day_meal_id", "diet_plan_id") WHERE ("diet_plan_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "comm_coach_clients_enroll_new_client" AFTER INSERT ON "public"."coach_clients" FOR EACH ROW EXECUTE FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"();



CREATE OR REPLACE TRIGGER "comm_coach_clients_unenroll_client" AFTER DELETE ON "public"."coach_clients" FOR EACH ROW EXECUTE FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"();



CREATE OR REPLACE TRIGGER "comm_guard_messages_update" BEFORE UPDATE ON "public"."comm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."comm_guard_messages_update"();



CREATE OR REPLACE TRIGGER "comm_guard_participants_update" BEFORE UPDATE ON "public"."comm_participants" FOR EACH ROW EXECUTE FUNCTION "public"."comm_guard_participants_update"();



CREATE OR REPLACE TRIGGER "comm_messages_update_conversation_ts" AFTER INSERT ON "public"."comm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."comm_trig_update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "comm_rate_limit_messages_insert" BEFORE INSERT ON "public"."comm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."comm_rate_limit_messages_insert"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."diet_plans" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."food_substitution_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."private_shopping_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."shopping_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"();



CREATE OR REPLACE TRIGGER "invitation_links_set_updated_at" BEFORE UPDATE ON "public"."invitation_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "on_diet_change_request_status_update" AFTER UPDATE ON "public"."diet_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."create_diet_change_notification"();



CREATE OR REPLACE TRIGGER "on_equivalence_adjustment_created" AFTER INSERT ON "public"."equivalence_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_equivalence_balance"();



CREATE OR REPLACE TRIGGER "on_user_recipe_conversion_from_free" AFTER INSERT ON "public"."user_recipes" FOR EACH ROW WHEN ((("new"."type" = 'private'::"text") AND ("new"."source_user_recipe_id" IS NOT NULL))) EXECUTE FUNCTION "public"."create_private_recipe_notification"();



CREATE OR REPLACE TRIGGER "on_weight_log_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."weight_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_current_weight"();



CREATE OR REPLACE TRIGGER "sync_full_name_trigger" BEFORE INSERT OR UPDATE OF "first_name", "last_name" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_full_name"();



CREATE OR REPLACE TRIGGER "trg_commercial_plan_features_updated_at" BEFORE UPDATE ON "public"."commercial_plan_features" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_commercial_plans_updated_at" BEFORE UPDATE ON "public"."commercial_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_subscriptions_updated_at" BEFORE UPDATE ON "public"."user_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trig_dpri_delete" INSTEAD OF DELETE ON "public"."diet_plan_recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."_trig_dpri_delete"();



CREATE OR REPLACE TRIGGER "trig_dpri_insert" INSTEAD OF INSERT ON "public"."diet_plan_recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."_trig_dpri_insert"();



CREATE OR REPLACE TRIGGER "trig_dpri_update" INSTEAD OF UPDATE ON "public"."diet_plan_recipe_ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."_trig_dpri_update"();



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



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_participants"
    ADD CONSTRAINT "comm_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_participants"
    ADD CONSTRAINT "comm_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_user_reads"
    ADD CONSTRAINT "comm_user_reads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_user_reads"
    ADD CONSTRAINT "comm_user_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commercial_plan_features"
    ADD CONSTRAINT "commercial_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."commercial_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commercial_plan_role_targets"
    ADD CONSTRAINT "commercial_plan_role_targets_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."commercial_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commercial_plan_role_targets"
    ADD CONSTRAINT "commercial_plan_role_targets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id");



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_equivalence_adjustment_id_fkey" FOREIGN KEY ("equivalence_adjustment_id") REFERENCES "public"."equivalence_adjustments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "daily_ingredient_adjustments_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id");



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "daily_meal_logs_free_recipe_occurrence_id_fkey" FOREIGN KEY ("free_recipe_occurrence_id") REFERENCES "public"."free_recipe_occurrences"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "dcr_req_changes_user_recipe_fk" FOREIGN KEY ("requested_changes_user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "dcr_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_ingredient_adjustments"
    ADD CONSTRAINT "dia_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id");



ALTER TABLE ONLY "public"."diet_change_requests"
    ADD CONSTRAINT "diet_change_requests_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "diet_plan_recipes_custom_recipe_style_id_fkey" FOREIGN KEY ("custom_recipe_style_id") REFERENCES "public"."recipe_styles"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."diet_type_food_group_rules"
    ADD CONSTRAINT "diet_type_food_group_rules_diet_type_id_fkey" FOREIGN KEY ("diet_type_id") REFERENCES "public"."diet_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_type_food_group_rules"
    ADD CONSTRAINT "diet_type_food_group_rules_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_meal_logs"
    ADD CONSTRAINT "dml_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "ea_source_user_recipe_fk" FOREIGN KEY ("source_user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_daily_snack_log_id_fkey" FOREIGN KEY ("source_daily_snack_log_id") REFERENCES "public"."daily_snack_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_diet_plan_recipe_id_fkey" FOREIGN KEY ("source_diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id");



ALTER TABLE ONLY "public"."equivalence_adjustments"
    ADD CONSTRAINT "equivalence_adjustments_source_free_recipe_occurrence_id_fkey" FOREIGN KEY ("source_free_recipe_occurrence_id") REFERENCES "public"."free_recipe_occurrences"("id");



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



ALTER TABLE ONLY "public"."diet_preferences"
    ADD CONSTRAINT "fk_diet_type" FOREIGN KEY ("diet_type_id") REFERENCES "public"."diet_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fat_types"
    ADD CONSTRAINT "fk_fat_classification" FOREIGN KEY ("fat_classification_id") REFERENCES "public"."fat_classification"("id");



ALTER TABLE ONLY "public"."food_antioxidants"
    ADD CONSTRAINT "fk_food" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_groups"
    ADD CONSTRAINT "fk_protein_source" FOREIGN KEY ("protein_source_id") REFERENCES "public"."protein_sources"("id");



ALTER TABLE ONLY "public"."diet_plan_recipes"
    ADD CONSTRAINT "fk_recipe" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diet_plans"
    ADD CONSTRAINT "fk_source_template" FOREIGN KEY ("source_template_id") REFERENCES "public"."diet_plans"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."food_substitution_mappings"
    ADD CONSTRAINT "food_substitution_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."food_substitution_mappings"
    ADD CONSTRAINT "food_substitution_mappings_source_food_id_fkey" FOREIGN KEY ("source_food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_substitution_mappings"
    ADD CONSTRAINT "food_substitution_mappings_target_food_id_fkey" FOREIGN KEY ("target_food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "free_recipe_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."free_recipe_occurrences"
    ADD CONSTRAINT "fro_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_assigned_center_id_fkey" FOREIGN KEY ("assigned_center_id") REFERENCES "public"."centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_assigned_role_id_fkey" FOREIGN KEY ("assigned_role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_invitation_link_id_fkey" FOREIGN KEY ("invitation_link_id") REFERENCES "public"."invitation_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_link_usages"
    ADD CONSTRAINT "invitation_link_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitation_links"
    ADD CONSTRAINT "invitation_links_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



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
    ADD CONSTRAINT "planned_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_meals"
    ADD CONSTRAINT "pm_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferred_foods"
    ADD CONSTRAINT "preferred_foods_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferred_foods"
    ADD CONSTRAINT "preferred_foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."private_shopping_list_items"
    ADD CONSTRAINT "private_shopping_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_activity_level_id_fkey" FOREIGN KEY ("activity_level_id") REFERENCES "public"."activity_levels"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_new_food_group_id_fkey" FOREIGN KEY ("food_group_id") REFERENCES "public"."food_groups"("id");



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_new_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_recipe_style_id_fkey" FOREIGN KEY ("recipe_style_id") REFERENCES "public"."recipe_styles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "ri_diet_plan_recipe_id_fkey" FOREIGN KEY ("diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "ri_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_ingredients"
    ADD CONSTRAINT "ri_user_recipe_fk" FOREIGN KEY ("user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_day_meal_fk" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_diet_plan_fk" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_parent_fk" FOREIGN KEY ("parent_user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_parent_recipe_fk" FOREIGN KEY ("parent_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_source_fk" FOREIGN KEY ("source_user_recipe_id") REFERENCES "public"."user_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "ur_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_centers"
    ADD CONSTRAINT "user_centers_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_centers"
    ADD CONSTRAINT "user_centers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_day_meal_id_fkey" FOREIGN KEY ("day_meal_id") REFERENCES "public"."day_meals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_diet_plan_id_fkey" FOREIGN KEY ("diet_plan_id") REFERENCES "public"."diet_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_day_meals"
    ADD CONSTRAINT "user_day_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_medical_conditions"
    ADD CONSTRAINT "user_medical_conditions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_recipe_style_id_fkey" FOREIGN KEY ("recipe_style_id") REFERENCES "public"."recipe_styles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_recipes"
    ADD CONSTRAINT "user_recipes_source_diet_plan_recipe_id_fkey" FOREIGN KEY ("source_diet_plan_recipe_id") REFERENCES "public"."diet_plan_recipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_sensitivity_id_fkey" FOREIGN KEY ("sensitivity_id") REFERENCES "public"."sensitivities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sensitivities"
    ADD CONSTRAINT "user_sensitivities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."commercial_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



CREATE POLICY "Admin full access commercial plan features" ON "public"."commercial_plan_features" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access commercial plan role targets" ON "public"."commercial_plan_role_targets" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access commercial plans" ON "public"."commercial_plans" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access on recipe_ingredients" ON "public"."recipe_ingredients" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access user subscriptions" ON "public"."user_subscriptions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin or coach can manage recipe_ingredients" ON "public"."recipe_ingredients" USING ("public"."is_admin_or_coach"()) WITH CHECK ("public"."is_admin_or_coach"());



CREATE POLICY "Admin read invitation link usages" ON "public"."invitation_link_usages" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admin read invitation links" ON "public"."invitation_links" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins and coaches can insert managed notifications" ON "public"."user_notifications" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "user_notifications"."user_id"))))));



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



CREATE POLICY "Allow admin full access" ON "public"."diet_type_food_group_rules" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



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



CREATE POLICY "Allow admin full access on food_substitution_mappings" ON "public"."food_substitution_mappings" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on food_to_food_groups" ON "public"."food_to_food_groups" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on free recipe occurrences" ON "public"."free_recipe_occurrences" USING ("public"."is_admin"());



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



CREATE POLICY "Allow admin full access on recipe_macros" ON "public"."recipe_macros" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on recipe_sensitivities" ON "public"."recipe_sensitivities" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on recipe_styles" ON "public"."recipe_styles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



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



CREATE POLICY "Allow admin full access on system_settings" ON "public"."system_settings" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_centers" ON "public"."user_centers" USING ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_day_meals" ON "public"."user_day_meals" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin full access on user_medical_conditions" ON "public"."user_medical_conditions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on user_recipes" ON "public"."user_recipes" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



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



CREATE POLICY "Allow admin full access to user utilities" ON "public"."user_utilities" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin read access on user_medical_conditions" ON "public"."user_medical_conditions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow admin to delete user roles" ON "public"."user_roles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Allow admin to have full access to weight logs" ON "public"."weight_logs" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin to insert user roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin to read all notifications" ON "public"."user_notifications" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Allow admin to update user roles" ON "public"."user_roles" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Allow all to read roles" ON "public"."medical_conditions" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."recipe_utilities" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."roles" FOR SELECT USING (true);



CREATE POLICY "Allow all to read roles" ON "public"."satiety_levels" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_classification" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_subtypes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."carb_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access" ON "public"."diet_type_food_group_rules" FOR SELECT TO "authenticated" USING (true);



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



CREATE POLICY "Allow authenticated read access on food_substitution_mappings" ON "public"."food_substitution_mappings" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated read access on food_to_carb_subtypes" ON "public"."food_to_carb_subtypes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on protein_sources" ON "public"."protein_sources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on recipe_styles" ON "public"."recipe_styles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access on seasons" ON "public"."seasons" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on stores" ON "public"."stores" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read access on system_settings" ON "public"."system_settings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read exercise_muscles" ON "public"."exercise_muscles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read exercises" ON "public"."exercises" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



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



CREATE POLICY "Allow users to delete own foods" ON "public"."food" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to delete recipes for their own plans" ON "public"."diet_plan_recipes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert macros for their own plans" ON "public"."recipe_macros" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to insert own foods" ON "public"."food" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to insert recipes for their own plans" ON "public"."diet_plan_recipes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage medical conditions for their own plans" ON "public"."diet_plan_medical_conditions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage own sensitivities and admins full access" ON "public"."user_sensitivities" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage sensitivities for their own plans" ON "public"."diet_plan_sensitivities" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_sensitivities"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own day meals" ON "public"."user_day_meals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own diet plan recipes" ON "public"."diet_plan_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_recipes"."diet_plan_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to manage their own diet preferences" ON "public"."diet_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own diet_plans" ON "public"."diet_plans" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own equivalence adjustments" ON "public"."equivalence_adjustments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own free recipe occurrences" ON "public"."free_recipe_occurrences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own meal logs" ON "public"."daily_meal_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own non preferred foods" ON "public"."non_preferred_foods" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own notifications" ON "public"."user_notifications" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own planned meals" ON "public"."planned_meals" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"())) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "Allow users to manage their own preferred foods" ON "public"."preferred_foods" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



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



CREATE POLICY "Allow users to manage their own user_recipes" ON "public"."user_recipes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own utilities" ON "public"."user_utilities" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to manage their own weight logs" ON "public"."weight_logs" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to see their own advisories" ON "public"."advisories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to update macros for their own plans" ON "public"."recipe_macros" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_macros"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow users to update own foods" ON "public"."food" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



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



CREATE POLICY "Coaches can delete client foods" ON "public"."food" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "food"."user_id")))));



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



CREATE POLICY "Coaches can manage client diet plan recipe ingredients" ON "public"."recipe_ingredients" USING ((("diet_plan_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (("public"."diet_plan_recipes"
     JOIN "public"."diet_plans" ON (("diet_plan_recipes"."diet_plan_id" = "diet_plans"."id")))
     JOIN "public"."coach_clients" ON (("diet_plans"."user_id" = "coach_clients"."client_id")))
  WHERE (("diet_plan_recipes"."id" = "recipe_ingredients"."diet_plan_recipe_id") AND ("coach_clients"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Coaches can manage client equivalence adjustments" ON "public"."equivalence_adjustments" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "equivalence_adjustments"."user_id")))));



CREATE POLICY "Coaches can manage client free recipe occurrences" ON "public"."free_recipe_occurrences" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients"
  WHERE (("coach_clients"."coach_id" = "auth"."uid"()) AND ("coach_clients"."client_id" = "free_recipe_occurrences"."user_id")))));



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



CREATE POLICY "Coaches can manage client user_recipes" ON "public"."user_recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "user_recipes"."user_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "user_recipes"."user_id")))));



CREATE POLICY "Coaches can manage conditions in their own templates" ON "public"."diet_plan_medical_conditions" USING ((EXISTS ( SELECT 1
   FROM "public"."diet_plans" "dp"
  WHERE (("dp"."id" = "diet_plan_medical_conditions"."diet_plan_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"())))));



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



CREATE POLICY "Coaches can manage ingredients in their own templates" ON "public"."recipe_ingredients" USING ((("diet_plan_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_ingredients"."diet_plan_recipe_id") AND ("dp"."is_template" = true) AND ("dp"."created_by" = "auth"."uid"()))))));



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



CREATE POLICY "Coaches can update client foods" ON "public"."food" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "food"."user_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."coach_clients" "cc"
  WHERE (("cc"."coach_id" = "auth"."uid"()) AND ("cc"."client_id" = "food"."user_id")))));



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



CREATE POLICY "Coaches manage client user_recipe ingredients" ON "public"."recipe_ingredients" USING ((("user_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."user_recipes" "ur"
     JOIN "public"."coach_clients" "cc" ON (("cc"."client_id" = "ur"."user_id")))
  WHERE (("ur"."id" = "recipe_ingredients"."user_recipe_id") AND ("cc"."coach_id" = "auth"."uid"())))))) WITH CHECK ((("user_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."user_recipes" "ur"
     JOIN "public"."coach_clients" "cc" ON (("cc"."client_id" = "ur"."user_id")))
  WHERE (("ur"."id" = "recipe_ingredients"."user_recipe_id") AND ("cc"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Coaches manage own templates" ON "public"."diet_plans" FOR UPDATE USING ((("is_template" = true) AND ("created_by" = "auth"."uid"()) AND ("template_scope" = 'global'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches view assigned centers" ON "public"."diet_plan_centers" FOR SELECT USING (true);



CREATE POLICY "Coaches view templates" ON "public"."diet_plans" FOR SELECT USING (((("is_template" = true) AND ("template_scope" = 'global'::"text")) OR (("is_template" = true) AND ("template_scope" = 'center'::"text") AND ("center_id" IN ( SELECT "user_centers"."center_id"
   FROM "public"."user_centers"
  WHERE ("user_centers"."user_id" = "auth"."uid"())))) OR (("is_template" = true) AND ("created_by" = "auth"."uid"()))));



CREATE POLICY "Public read active commercial plans" ON "public"."commercial_plans" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read commercial features" ON "public"."commercial_plan_features" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."commercial_plans" "p"
  WHERE (("p"."id" = "commercial_plan_features"."plan_id") AND ("p"."is_active" = true)))));



CREATE POLICY "Public read commercial plan targets" ON "public"."commercial_plan_role_targets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."commercial_plans" "p"
  WHERE (("p"."id" = "commercial_plan_role_targets"."plan_id") AND ("p"."is_active" = true)))));



CREATE POLICY "User or admin can delete conditions" ON "public"."user_medical_conditions" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "User or admin can insert conditions" ON "public"."user_medical_conditions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "User or admin can update conditions" ON "public"."user_medical_conditions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Users can manage own assignment progress" ON "public"."assignment_progress" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own calorie overrides" ON "public"."diet_plan_calorie_overrides" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own diet plan recipe ingredients" ON "public"."recipe_ingredients" USING ((("diet_plan_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."diet_plan_recipes" "dpr"
     JOIN "public"."diet_plans" "dp" ON (("dpr"."diet_plan_id" = "dp"."id")))
  WHERE (("dpr"."id" = "recipe_ingredients"."diet_plan_recipe_id") AND ("dp"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can read own subscriptions" ON "public"."user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read template recipe_ingredients" ON "public"."recipe_ingredients" FOR SELECT USING ((("recipe_id" IS NOT NULL) AND ("auth"."role"() = 'authenticated'::"text")));



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



CREATE POLICY "Users manage own user_recipe ingredients" ON "public"."recipe_ingredients" USING ((("user_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_recipes" "ur"
  WHERE (("ur"."id" = "recipe_ingredients"."user_recipe_id") AND ("ur"."user_id" = "auth"."uid"())))))) WITH CHECK ((("user_recipe_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_recipes" "ur"
  WHERE (("ur"."id" = "recipe_ingredients"."user_recipe_id") AND ("ur"."user_id" = "auth"."uid"()))))));



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


CREATE POLICY "comm_conv_delete" ON "public"."comm_conversations" FOR DELETE USING (("public"."is_admin"() OR ("created_by" = "auth"."uid"())));



CREATE POLICY "comm_conv_insert" ON "public"."comm_conversations" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "comm_conv_select" ON "public"."comm_conversations" FOR SELECT USING ("public"."comm_can_read_conversation"("id"));



CREATE POLICY "comm_conv_update" ON "public"."comm_conversations" FOR UPDATE USING (("public"."is_admin"() OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."comm_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_msg_delete" ON "public"."comm_messages" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "comm_msg_insert" ON "public"."comm_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."comm_can_write_conversation"("conversation_id")));



CREATE POLICY "comm_msg_select" ON "public"."comm_messages" FOR SELECT USING ("public"."comm_can_read_conversation"("conversation_id"));



CREATE POLICY "comm_msg_update" ON "public"."comm_messages" FOR UPDATE USING ((("sender_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("sender_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "comm_part_delete" ON "public"."comm_participants" FOR DELETE USING (("public"."is_admin"() OR ("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."comm_conversations" "c"
  WHERE (("c"."id" = "comm_participants"."conversation_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "comm_part_insert" ON "public"."comm_participants" FOR INSERT WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."comm_conversations" "c"
  WHERE (("c"."id" = "comm_participants"."conversation_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "comm_part_select" ON "public"."comm_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."comm_conversations" "c"
  WHERE (("c"."id" = "comm_participants"."conversation_id") AND ("c"."created_by" = "auth"."uid"()))))));



CREATE POLICY "comm_part_update" ON "public"."comm_participants" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."comm_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_user_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_user_reads_delete" ON "public"."comm_user_reads" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "comm_user_reads_insert" ON "public"."comm_user_reads" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "comm_user_reads_select" ON "public"."comm_user_reads" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "comm_user_reads_update" ON "public"."comm_user_reads" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."commercial_plan_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commercial_plan_role_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commercial_plans" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."diet_plan_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plan_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diet_type_food_group_rules" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."food_substitution_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_carb_subtypes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_food_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_macro_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_to_stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_vitamins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."free_recipe_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_link_usages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_links" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."recipe_styles" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_centers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_day_meals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sensitivities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


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



GRANT ALL ON FUNCTION "public"."_trig_dpri_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_dpri_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_dpri_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_dpri_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_dpri_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_dpri_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_dpri_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_dpri_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_dpri_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_fri_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_fri_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_fri_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_fri_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_fri_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_fri_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_fri_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_fri_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_fri_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_pri_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_pri_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_pri_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_pri_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_pri_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_pri_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig_pri_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."_trig_pri_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig_pri_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_global_recipe_to_plan"("p_user_id" "uuid", "p_day_meal_id" bigint, "p_recipe_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_issue_invitation_link"("p_destination" "text", "p_role_id" integer, "p_center_id" bigint, "p_max_uses" integer, "p_note" "text", "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_issue_invitation_link"("p_destination" "text", "p_role_id" integer, "p_center_id" bigint, "p_max_uses" integer, "p_note" "text", "p_expires_at" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_issue_invitation_link"("p_destination" "text", "p_role_id" integer, "p_center_id" bigint, "p_max_uses" integer, "p_note" "text", "p_expires_at" timestamp with time zone) TO "authenticated";



GRANT ALL ON TABLE "public"."invitation_links" TO "anon";
GRANT ALL ON TABLE "public"."invitation_links" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_links" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_revoke_invitation_link"("p_invitation_link_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revoke_invitation_link"("p_invitation_link_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_revoke_invitation_link"("p_invitation_link_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."admin_upsert_user_subscription"("p_user_id" "uuid", "p_plan_id" bigint, "p_status" "text", "p_source" "text", "p_is_complimentary" boolean, "p_amount_paid" numeric, "p_currency" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_notes" "text", "p_sync_role" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_upsert_user_subscription"("p_user_id" "uuid", "p_plan_id" bigint, "p_status" "text", "p_source" "text", "p_is_complimentary" boolean, "p_amount_paid" numeric, "p_currency" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_notes" "text", "p_sync_role" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_user_subscription"("p_user_id" "uuid", "p_plan_id" bigint, "p_status" "text", "p_source" "text", "p_is_complimentary" boolean, "p_amount_paid" numeric, "p_currency" "text", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_notes" "text", "p_sync_role" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_free_recipe_as_global"("p_free_recipe_id" bigint, "p_recipe_data" "jsonb", "p_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_diet_plan_recipe"("p_recipe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_diet_plan_recipe"("p_recipe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_diet_plan_recipe"("p_recipe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_user_recipe"("p_recipe_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_user_recipe"("p_recipe_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_user_recipe"("p_recipe_id" bigint) TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_can_read_conversation"("p_conv_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_can_write_conversation"("p_conv_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_name" "text", "p_description" "text", "p_broadcast_scope" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_get_or_create_admin_convo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_get_or_create_admin_convo"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_get_or_create_admin_convo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_get_or_create_admin_convo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_get_or_create_direct"("p_other_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_get_unread_total"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_get_unread_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_get_unread_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_get_unread_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_guard_messages_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_guard_messages_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_guard_messages_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_guard_participants_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_guard_participants_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_guard_participants_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_list_conversations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_list_conversations"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_list_conversations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_list_conversations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_list_conversations_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_list_conversations_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_list_conversations_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_list_conversations_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_mark_conversation_read"("p_conv_id" "uuid", "p_read_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_rate_limit_messages_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_rate_limit_messages_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_rate_limit_messages_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_trig_enroll_new_client_in_coach_channels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_trig_unenroll_removed_client_from_coach_channels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_trig_update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_trig_update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_trig_update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_free_to_private_recipe"("p_free_recipe_id" bigint, "p_new_recipe_data" "jsonb", "p_new_ingredients" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_diet_change_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_private_recipe_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_diet_plan_recipe_with_dependencies"("p_recipe_id" bigint) FROM PUBLIC;
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



REVOKE ALL ON FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_private_recipe_cascade"("p_recipe_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_snack_and_dependencies"("p_snack_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_complete"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_recipe_variant_if_unused"("p_recipe_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_recipe_variant_if_unused"("p_recipe_id" bigint) TO "service_role";
GRANT ALL ON FUNCTION "public"."delete_user_recipe_variant_if_unused"("p_recipe_id" bigint) TO "authenticated";



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



REVOKE ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_users_with_free_recipes_by_status"("p_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_pending_foods_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hash_invitation_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hash_invitation_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_invitation_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_invitation_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_coach"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_client_role"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_client_role"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_client_role"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach_role"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach_role"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach_role"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "anon";
GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."nombre_de_tu_funcion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."peek_invitation_link"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."peek_invitation_link"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."peek_invitation_link"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."peek_invitation_link"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_invitation_link"("p_token" "text", "p_source" "text", "p_user_agent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_invitation_link"("p_token" "text", "p_source" "text", "p_user_agent" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."redeem_invitation_link"("p_token" "text", "p_source" "text", "p_user_agent" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_full_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_full_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_full_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_role_from_subscription"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_role_from_subscription"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_role_from_subscription"("p_user_id" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_free_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_private_recipe"("p_recipe_id" bigint, "p_name" "text", "p_instructions" "text", "p_prep_time_min" integer, "p_difficulty" "text", "p_ingredients" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_current_weight"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("p_user_id" "uuid", "p_roles" "text"[]) TO "service_role";



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



GRANT ALL ON TABLE "public"."comm_conversations" TO "anon";
GRANT ALL ON TABLE "public"."comm_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."comm_messages" TO "anon";
GRANT ALL ON TABLE "public"."comm_messages" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."comm_messages" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."comm_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comm_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comm_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comm_participants" TO "anon";
GRANT ALL ON TABLE "public"."comm_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_participants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comm_participants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comm_participants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comm_participants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comm_user_reads" TO "anon";
GRANT ALL ON TABLE "public"."comm_user_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_user_reads" TO "service_role";



GRANT ALL ON TABLE "public"."commercial_plan_features" TO "anon";
GRANT ALL ON TABLE "public"."commercial_plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."commercial_plan_features" TO "service_role";



GRANT ALL ON SEQUENCE "public"."commercial_plan_features_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."commercial_plan_features_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."commercial_plan_features_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."commercial_plan_role_targets" TO "anon";
GRANT ALL ON TABLE "public"."commercial_plan_role_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."commercial_plan_role_targets" TO "service_role";



GRANT ALL ON TABLE "public"."commercial_plans" TO "anon";
GRANT ALL ON TABLE "public"."commercial_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."commercial_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."commercial_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."commercial_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."commercial_plans_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_plan_recipe_ingredients" TO "service_role";



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



GRANT ALL ON TABLE "public"."diet_type_food_group_rules" TO "anon";
GRANT ALL ON TABLE "public"."diet_type_food_group_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."diet_type_food_group_rules" TO "service_role";



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



GRANT ALL ON TABLE "public"."food_substitution_mappings" TO "anon";
GRANT ALL ON TABLE "public"."food_substitution_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."food_substitution_mappings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."food_substitution_mappings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_substitution_mappings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_substitution_mappings_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_recipes" TO "anon";
GRANT ALL ON TABLE "public"."user_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_recipes" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipe_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipe_occurrences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."free_recipe_occurrences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."free_recipes" TO "anon";
GRANT ALL ON TABLE "public"."free_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."free_recipes" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_link_usages" TO "anon";
GRANT ALL ON TABLE "public"."invitation_link_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_link_usages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invitation_link_usages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invitation_link_usages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invitation_link_usages_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."private_recipes" TO "anon";
GRANT ALL ON TABLE "public"."private_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."private_recipes" TO "service_role";



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



GRANT ALL ON SEQUENCE "public"."recipe_ingredients_new_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recipe_ingredients_new_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recipe_ingredients_new_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."recipe_styles" TO "anon";
GRANT ALL ON TABLE "public"."recipe_styles" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_styles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recipe_styles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recipe_styles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recipe_styles_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."training_preferences" TO "anon";
GRANT ALL ON TABLE "public"."training_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."training_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_centers" TO "anon";
GRANT ALL ON TABLE "public"."user_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_centers" TO "service_role";



GRANT ALL ON TABLE "public"."user_day_meals" TO "anon";
GRANT ALL ON TABLE "public"."user_day_meals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_day_meals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_day_meals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."user_medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_notifications_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_recipes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_recipes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_recipes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sensitivities" TO "anon";
GRANT ALL ON TABLE "public"."user_sensitivities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sensitivities" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_subscriptions_id_seq" TO "service_role";



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






