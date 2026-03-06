BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_recipe_variant_if_unused(p_recipe_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.delete_user_recipe_variant_if_unused(bigint) FROM public;
REVOKE ALL ON FUNCTION public.delete_user_recipe_variant_if_unused(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user_recipe_variant_if_unused(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_recipe_variant_if_unused(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_recipe_variant_if_unused(bigint) TO service_role;

COMMIT;
