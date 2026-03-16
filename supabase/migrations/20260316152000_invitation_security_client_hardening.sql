BEGIN;

-- ============================================================================
-- 1) Persist only token hashes + safe preview
-- ============================================================================
ALTER TABLE public.invitation_links
  ADD COLUMN IF NOT EXISTS token_preview text;

-- Normalize all tokens to lowercase sha256 hashes.
UPDATE public.invitation_links
SET token = CASE
  WHEN token ~ '^[a-f0-9]{64}$' THEN lower(token)
  ELSE encode(digest(lower(trim(token)), 'sha256'), 'hex')
END
WHERE token IS NOT NULL;

-- Ensure preview exists and always follows safe format.
UPDATE public.invitation_links
SET token_preview = left(token, 6) || '...' || right(token, 4)
WHERE token_preview IS NULL
   OR token_preview !~ '^[a-z0-9]{6}\\.\\.\\.[a-z0-9]{4}$';

ALTER TABLE public.invitation_links
  DROP CONSTRAINT IF EXISTS invitation_links_token_length_check;

ALTER TABLE public.invitation_links
  DROP CONSTRAINT IF EXISTS invitation_links_token_hash_check;

ALTER TABLE public.invitation_links
  ADD CONSTRAINT invitation_links_token_hash_check
  CHECK (token ~ '^[a-f0-9]{64}$');

ALTER TABLE public.invitation_links
  ALTER COLUMN token_preview SET NOT NULL;

-- Helper for consistent token hashing.
CREATE OR REPLACE FUNCTION public.hash_invitation_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT encode(digest(lower(trim(p_token)), 'sha256'), 'hex');
$$;

ALTER FUNCTION public.hash_invitation_token(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hash_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_invitation_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_invitation_token(text) TO service_role;

-- ============================================================================
-- 2) Admin issuance flow: return token once, persist only hash
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_issue_invitation_link(
  p_destination text DEFAULT 'signup',
  p_role_id integer DEFAULT NULL,
  p_center_id bigint DEFAULT NULL,
  p_max_uses integer DEFAULT 1,
  p_note text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  issued_token text,
  token_preview text,
  destination text,
  role_id integer,
  center_id bigint,
  max_uses integer,
  used_uses integer,
  note text,
  expires_at timestamptz,
  is_revoked boolean,
  revoked_at timestamptz,
  revoked_by uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) TO service_role;

-- Decommission legacy issuer. Only the secure admin_issue_invitation_link stays available.
DROP FUNCTION IF EXISTS public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
);

-- ============================================================================
-- 3) Harden peek/redeem: hash lookup + anti-role-takeover controls
-- ============================================================================
CREATE OR REPLACE FUNCTION public.peek_invitation_link(p_token text)
RETURNS TABLE(
  status text,
  role_name text,
  center_name text,
  expires_at timestamptz,
  max_uses integer,
  used_uses integer,
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
$$;

ALTER FUNCTION public.peek_invitation_link(text) OWNER TO postgres;

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
  ON CONFLICT (invitation_link_id, user_id) DO NOTHING
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
$$;

ALTER FUNCTION public.redeem_invitation_link(text, text, text) OWNER TO postgres;

COMMIT;
