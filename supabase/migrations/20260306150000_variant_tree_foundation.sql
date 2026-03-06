-- =============================================================================
-- Variant Tree Foundation
-- Establece la base de datos para el árbol de variantes tipo git.
--
-- Cambios:
--   1. Añade is_archived, archived_at a user_recipes y diet_plan_recipes
--   2. Añade source_diet_plan_recipe_id, variant_label, diff_summary a user_recipes
--   3. Añade 'variant' al CHECK de user_recipes.type
--   4. Crea funciones archive_user_recipe y archive_diet_plan_recipe
--   5. Revoca acceso a las funciones de hard delete desde authenticated
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: Nuevos campos en user_recipes
-- =============================================================================

ALTER TABLE public.user_recipes
  ADD COLUMN IF NOT EXISTS is_archived         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at         timestamptz,
  ADD COLUMN IF NOT EXISTS source_diet_plan_recipe_id
                                               bigint      REFERENCES public.diet_plan_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_label       text,
  ADD COLUMN IF NOT EXISTS diff_summary        jsonb;

-- Ampliar el CHECK de type para incluir 'variant'
ALTER TABLE public.user_recipes
  DROP CONSTRAINT IF EXISTS user_recipes_type_check;

ALTER TABLE public.user_recipes
  ADD CONSTRAINT user_recipes_type_check
  CHECK (type IN ('free', 'private', 'variant'));

-- Índice para consultas del árbol por raíz canónica
CREATE INDEX IF NOT EXISTS idx_ur_source_diet_plan_recipe_id
  ON public.user_recipes (source_diet_plan_recipe_id)
  WHERE source_diet_plan_recipe_id IS NOT NULL;

-- Índice para filtrar archivados
CREATE INDEX IF NOT EXISTS idx_ur_is_archived
  ON public.user_recipes (is_archived);

-- =============================================================================
-- SECTION 2: Nuevos campos en diet_plan_recipes
-- =============================================================================

ALTER TABLE public.diet_plan_recipes
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Índice para filtrar archivados
CREATE INDEX IF NOT EXISTS idx_dpr_is_archived
  ON public.diet_plan_recipes (is_archived);

-- =============================================================================
-- SECTION 3: Función archive_user_recipe
-- Archiva un nodo user_recipe sin tocar hijos, logs ni planned_meals.
-- Solo el propietario o un admin puede archivar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.archive_user_recipe(p_recipe_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =============================================================================
-- SECTION 4: Función archive_diet_plan_recipe
-- Archiva un nodo diet_plan_recipe.
-- Solo admin o coach del cliente pueden archivar.
-- No bloquea si hay user_recipes activos — esos siguen apuntando al nodo
-- archivado (ghost node). El front mostrará el padre como ghost si es necesario.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.archive_diet_plan_recipe(p_recipe_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =============================================================================
-- SECTION 5: Revocar acceso a funciones de hard delete desde authenticated
-- Las funciones siguen existiendo para service_role (mantenimiento),
-- pero ningún usuario ni coach puede ejecutarlas directamente.
-- =============================================================================

REVOKE ALL ON FUNCTION public.delete_diet_plan_recipe_with_dependencies(bigint) FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_private_recipe_cascade(bigint) FROM authenticated;

-- Grant de las nuevas funciones de archivo
GRANT EXECUTE ON FUNCTION public.archive_user_recipe(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_diet_plan_recipe(bigint) TO authenticated;

-- =============================================================================
-- SECTION 6: Consistencia — marcar user_recipes existentes con type='private'
-- que tengan parent_recipe_id o diet_plan_id como 'variant' es un cambio
-- de datos opcional. Lo dejamos como NO-OP aquí para no alterar datos
-- existentes sin una decisión explícita. Los nuevos registros usarán 'variant'.
-- =============================================================================

COMMIT;
