-- Filtros extendidos para el sistema de Difusión
-- Añade columnas a broadcasts y actualiza las funciones de segmentación.

-- ─── Nuevas columnas de filtrado ──────────────────────────────────────────────

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS filter_sex               text[],       -- ARRAY['Hombre','Mujer']
  ADD COLUMN IF NOT EXISTS filter_age_min           int,          -- años mínimos
  ADD COLUMN IF NOT EXISTS filter_age_max           int,          -- años máximos
  ADD COLUMN IF NOT EXISTS filter_cities            text[],       -- ARRAY['Madrid','Barcelona']
  ADD COLUMN IF NOT EXISTS filter_profile_type      text,         -- 'free' | 'paid'
  ADD COLUMN IF NOT EXISTS filter_has_coach         boolean,      -- true=con coach / false=sin coach
  ADD COLUMN IF NOT EXISTS filter_no_diet_plan      boolean,      -- true=sin plan de dieta
  ADD COLUMN IF NOT EXISTS filter_registered_after  timestamptz,  -- registrados desde esta fecha
  ADD COLUMN IF NOT EXISTS filter_registered_before timestamptz;  -- registrados hasta esta fecha

-- ─── Helper actualizado: _broadcast_target_users ──────────────────────────────
-- Recibe el ID del broadcast y aplica TODOS los filtros disponibles.

CREATE OR REPLACE FUNCTION public._broadcast_target_users(p_broadcast_id bigint)
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.user_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  JOIN public.roles r       ON r.id = ur.role_id
  CROSS JOIN (
    SELECT
      filter_roles, filter_subscription_status, filter_center_ids,
      filter_onboarding_done, filter_sex, filter_age_min, filter_age_max,
      filter_cities, filter_profile_type, filter_has_coach,
      filter_no_diet_plan, filter_registered_after, filter_registered_before
    FROM public.broadcasts
    WHERE id = p_broadcast_id
  ) b
  WHERE
    (b.filter_roles IS NULL OR r.role = ANY(b.filter_roles))

    AND (b.filter_subscription_status IS NULL OR EXISTS (
      SELECT 1 FROM public.user_subscriptions s
      WHERE s.user_id = p.user_id AND s.status = ANY(b.filter_subscription_status)
    ))

    AND (b.filter_center_ids IS NULL OR EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.user_id = p.user_id
        AND uc.center_id::text = ANY(
          ARRAY(SELECT fc::text FROM unnest(b.filter_center_ids) AS fc)
        )
    ))

    AND (b.filter_onboarding_done IS NULL
      OR (b.filter_onboarding_done = (p.onboarding_completed_at IS NOT NULL)))

    AND (b.filter_sex IS NULL OR p.sex = ANY(b.filter_sex))

    AND (b.filter_age_min IS NULL
      OR (p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(NOW(), p.birth_date)) >= b.filter_age_min))

    AND (b.filter_age_max IS NULL
      OR (p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(NOW(), p.birth_date)) <= b.filter_age_max))

    AND (b.filter_cities IS NULL
      OR lower(p.city) = ANY(
        SELECT lower(c) FROM unnest(b.filter_cities) c
      ))

    AND (b.filter_profile_type IS NULL
      OR (b.filter_profile_type = 'free'  AND p.profile_type = 'free')
      OR (b.filter_profile_type = 'paid'  AND p.profile_type != 'free'))

    AND (b.filter_has_coach IS NULL
      OR b.filter_has_coach = EXISTS (
        SELECT 1 FROM public.coach_clients cc WHERE cc.client_id = p.user_id
      ))

    AND (b.filter_no_diet_plan IS NULL
      OR b.filter_no_diet_plan = NOT EXISTS (
        SELECT 1 FROM public.diet_plans dp WHERE dp.user_id = p.user_id
      ))

    AND (b.filter_registered_after IS NULL
      OR p.created_at >= b.filter_registered_after)

    AND (b.filter_registered_before IS NULL
      OR p.created_at <= b.filter_registered_before);
$$;

-- ─── RPC de preview inline (sin necesidad de guardar el draft) ────────────────
-- Acepta todos los filtros como parámetros y devuelve el COUNT de usuarios.
-- Se llama desde el editor en tiempo real mientras el admin ajusta filtros.

CREATE OR REPLACE FUNCTION public.admin_preview_broadcast_inline(
  p_filter_roles               text[]      DEFAULT NULL,
  p_filter_subscription_status text[]      DEFAULT NULL,
  p_filter_center_ids          bigint[]    DEFAULT NULL,
  p_filter_onboarding_done     boolean     DEFAULT NULL,
  p_filter_sex                 text[]      DEFAULT NULL,
  p_filter_age_min             int         DEFAULT NULL,
  p_filter_age_max             int         DEFAULT NULL,
  p_filter_cities              text[]      DEFAULT NULL,
  p_filter_profile_type        text        DEFAULT NULL,
  p_filter_has_coach           boolean     DEFAULT NULL,
  p_filter_no_diet_plan        boolean     DEFAULT NULL,
  p_filter_registered_after    timestamptz DEFAULT NULL,
  p_filter_registered_before   timestamptz DEFAULT NULL
)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(DISTINCT p.user_id)::int
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  JOIN public.roles r       ON r.id = ur.role_id
  WHERE
    (p_filter_roles IS NULL OR r.role = ANY(p_filter_roles))

    AND (p_filter_subscription_status IS NULL OR EXISTS (
      SELECT 1 FROM public.user_subscriptions s
      WHERE s.user_id = p.user_id AND s.status = ANY(p_filter_subscription_status)
    ))

    AND (p_filter_center_ids IS NULL OR EXISTS (
      SELECT 1 FROM public.user_centers uc
      WHERE uc.user_id = p.user_id AND uc.center_id = ANY(p_filter_center_ids)
    ))

    AND (p_filter_onboarding_done IS NULL
      OR (p_filter_onboarding_done = (p.onboarding_completed_at IS NOT NULL)))

    AND (p_filter_sex IS NULL OR p.sex = ANY(p_filter_sex))

    AND (p_filter_age_min IS NULL
      OR (p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(NOW(), p.birth_date)) >= p_filter_age_min))

    AND (p_filter_age_max IS NULL
      OR (p.birth_date IS NOT NULL
          AND EXTRACT(YEAR FROM AGE(NOW(), p.birth_date)) <= p_filter_age_max))

    AND (p_filter_cities IS NULL
      OR lower(p.city) = ANY(
        SELECT lower(c) FROM unnest(p_filter_cities) c
      ))

    AND (p_filter_profile_type IS NULL
      OR (p_filter_profile_type = 'free' AND p.profile_type = 'free')
      OR (p_filter_profile_type = 'paid' AND p.profile_type != 'free'))

    AND (p_filter_has_coach IS NULL
      OR p_filter_has_coach = EXISTS (
        SELECT 1 FROM public.coach_clients cc WHERE cc.client_id = p.user_id
      ))

    AND (p_filter_no_diet_plan IS NULL
      OR p_filter_no_diet_plan = NOT EXISTS (
        SELECT 1 FROM public.diet_plans dp WHERE dp.user_id = p.user_id
      ))

    AND (p_filter_registered_after IS NULL
      OR p.created_at >= p_filter_registered_after)

    AND (p_filter_registered_before IS NULL
      OR p.created_at <= p_filter_registered_before);
$$;

ALTER FUNCTION public.admin_preview_broadcast_inline(
  text[], text[], bigint[], boolean,
  text[], int, int, text[], text, boolean, boolean, timestamptz, timestamptz
) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_preview_broadcast_inline(
  text[], text[], bigint[], boolean,
  text[], int, int, text[], text, boolean, boolean, timestamptz, timestamptz
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public._broadcast_target_users(bigint) TO authenticated, service_role;
