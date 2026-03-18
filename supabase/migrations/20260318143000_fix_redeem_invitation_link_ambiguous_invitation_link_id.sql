BEGIN;

-- Fix: "column reference invitation_link_id is ambiguous" (PostgreSQL 42702).
--
-- redeem_invitation_link uses RETURNS TABLE(..., invitation_link_id uuid, role_id integer, center_id bigint, ...).
-- PL/pgSQL exposes RETURNS TABLE columns as implicit output variables.
-- The previous migration fixed role_id/center_id conflicts in user_roles and user_centers.
-- This migration fixes the remaining conflict target ON CONFLICT (invitation_link_id, user_id),
-- replacing it with ON CONFLICT ON CONSTRAINT ... so PostgreSQL does not confuse
-- invitation_link_id with the RETURNS TABLE output variable.

CREATE OR REPLACE FUNCTION public.redeem_invitation_link(
  p_token text,
  p_source text DEFAULT 'web',
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(
  status text,
  invitation_link_id uuid,
  role_id integer,
  center_id bigint,
  used_uses integer,
  max_uses integer,
  expires_at timestamptz,
  is_revoked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      NULL::uuid, NULL::integer, NULL::bigint,
      NULL::integer, NULL::integer, NULL::timestamptz, NULL::boolean;
    RETURN;
  END IF;

  IF v_token !~ '^[a-z0-9]{24,96}$' THEN
    RETURN QUERY SELECT
      'invalid_token'::text,
      NULL::uuid, NULL::integer, NULL::bigint,
      NULL::integer, NULL::integer, NULL::timestamptz, NULL::boolean;
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
      NULL::uuid, NULL::integer, NULL::bigint,
      NULL::integer, NULL::integer, NULL::timestamptz, NULL::boolean;
    RETURN;
  END IF;

  -- ── Already redeemed by this user ─────────────────────────────────────────
  SELECT iu.id
  INTO v_usage_id
  FROM public.invitation_link_usages iu
  WHERE iu.invitation_link_id = v_invitation.id
    AND iu.user_id = auth.uid()
  LIMIT 1;

  IF v_usage_id IS NOT NULL THEN
    -- Re-apply role/center idempotently.
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (auth.uid(), v_invitation.role_id)
    ON CONFLICT ON CONSTRAINT user_roles_pkey              -- fixes role_id ambiguity
    DO UPDATE SET role_id = EXCLUDED.role_id;

    IF v_invitation.center_id IS NULL THEN
      DELETE FROM public.user_centers uc
      WHERE uc.user_id = auth.uid();
    ELSE
      DELETE FROM public.user_centers uc
      WHERE uc.user_id = auth.uid()
        AND uc.center_id IS DISTINCT FROM v_invitation.center_id;

      INSERT INTO public.user_centers (user_id, center_id)
      VALUES (auth.uid(), v_invitation.center_id)
      ON CONFLICT ON CONSTRAINT user_centers_pkey           -- fixes center_id ambiguity
      DO NOTHING;
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

  -- ── Role eligibility checks ───────────────────────────────────────────────
  SELECT lower(r.role)
  INTO v_current_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1;

  IF v_current_role IN ('admin', 'coach', 'coach-nutrition', 'coach-workout') THEN
    RETURN QUERY SELECT
      'forbidden_role'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_current_role IS NOT NULL AND v_current_role <> 'free' THEN
    RETURN QUERY SELECT
      'ineligible_role'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
    RETURN;
  END IF;

  -- ── Invitation state checks ───────────────────────────────────────────────
  IF v_invitation.is_revoked THEN
    RETURN QUERY SELECT
      'revoked'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= v_now THEN
    RETURN QUERY SELECT
      'expired'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
    RETURN;
  END IF;

  IF v_invitation.max_uses IS NOT NULL AND v_invitation.used_uses >= v_invitation.max_uses THEN
    RETURN QUERY SELECT
      'exhausted'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
    RETURN;
  END IF;

  -- ── Apply invitation ──────────────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (auth.uid(), v_invitation.role_id)
  ON CONFLICT ON CONSTRAINT user_roles_pkey                 -- fixes role_id ambiguity
  DO UPDATE SET role_id = EXCLUDED.role_id;

  IF v_invitation.center_id IS NULL THEN
    DELETE FROM public.user_centers uc
    WHERE uc.user_id = auth.uid();
  ELSE
    DELETE FROM public.user_centers uc
    WHERE uc.user_id = auth.uid()
      AND uc.center_id IS DISTINCT FROM v_invitation.center_id;

    INSERT INTO public.user_centers (user_id, center_id)
    VALUES (auth.uid(), v_invitation.center_id)
    ON CONFLICT ON CONSTRAINT user_centers_pkey             -- fixes center_id ambiguity
    DO NOTHING;
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
  ON CONFLICT ON CONSTRAINT invitation_link_usages_invitation_link_id_user_id_key  -- fixes invitation_link_id ambiguity
  DO NOTHING
  RETURNING id INTO v_usage_id;

  IF v_usage_id IS NULL THEN
    RETURN QUERY SELECT
      'already_redeemed'::text,
      v_invitation.id, v_invitation.role_id, v_invitation.center_id,
      v_invitation.used_uses, v_invitation.max_uses,
      v_invitation.expires_at, v_invitation.is_revoked;
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
$$;

ALTER FUNCTION public.redeem_invitation_link(text, text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.redeem_invitation_link(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invitation_link(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.redeem_invitation_link(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_link(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation_link(text, text, text) TO service_role;

COMMIT;
