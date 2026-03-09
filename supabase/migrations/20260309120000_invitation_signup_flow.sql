BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ampliar constraint de destination para admitir 'signup'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invitation_links
  DROP CONSTRAINT IF EXISTS invitation_links_destination_check;

ALTER TABLE public.invitation_links
  ADD CONSTRAINT invitation_links_destination_check
  CHECK (destination IN ('login', 'signup'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. peek_invitation_link — lectura pública sin autenticación
--    Devuelve el estado del link + metadatos legibles (rol, centro, expiración)
--    sin modificar nada. Permite que SignUpPage muestre un banner antes del auth.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.peek_invitation_link(p_token text)
RETURNS TABLE(
  status      text,
  role_name   text,
  center_name text,
  expires_at  timestamptz,
  max_uses    integer,
  used_uses   integer,
  is_revoked  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now    timestamptz := now();
  v_token  text        := lower(trim(COALESCE(p_token, '')));
  v_inv    public.invitation_links%ROWTYPE;
  v_role   text;
  v_center text;
BEGIN
  IF v_token = '' THEN
    RETURN QUERY SELECT
      'missing_token'::text, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, NULL::boolean;
    RETURN;
  END IF;

  SELECT * INTO v_inv
  FROM   public.invitation_links
  WHERE  token = v_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'invalid_token'::text, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, NULL::boolean;
    RETURN;
  END IF;

  SELECT r.role INTO v_role   FROM public.roles   r WHERE r.id = v_inv.role_id;
  SELECT c.name INTO v_center FROM public.centers c WHERE c.id = v_inv.center_id;

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

-- Accesible sin autenticación (anon) para que la página de registro pueda
-- mostrar el banner de estado antes de que el usuario tenga sesión.
REVOKE ALL ON FUNCTION public.peek_invitation_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_invitation_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.peek_invitation_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_invitation_link(text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Actualizar admin_create_invitation_link
--    · Default destination → 'signup'
--    · Acepta tanto 'login' como 'signup'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_invitation_link(
  p_destination text        DEFAULT 'signup',
  p_role_id     integer     DEFAULT NULL,
  p_center_id   bigint      DEFAULT NULL,
  p_max_uses    integer     DEFAULT 1,
  p_note        text        DEFAULT NULL,
  p_expires_at  timestamptz DEFAULT NULL
)
RETURNS public.invitation_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_token      text;
  v_invitation public.invitation_links;
  v_role_name  text;
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

  SELECT r.role INTO v_role_name
  FROM   public.roles r
  WHERE  r.id = p_role_id;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found: %', p_role_id;
  END IF;

  IF lower(v_role_name) NOT IN ('free', 'client', 'coach') THEN
    RAISE EXCEPTION 'Invitations can only assign free/client/coach roles.';
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
    v_token := lower(replace(gen_random_uuid()::text, '-', ''))
      || substr(lower(replace(gen_random_uuid()::text, '-', '')), 1, 8);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.invitation_links WHERE token = v_token
    );
  END LOOP;

  INSERT INTO public.invitation_links (
    token, destination, role_id, center_id, max_uses, note, expires_at, created_by
  )
  VALUES (
    v_token,
    COALESCE(NULLIF(trim(p_destination), ''), 'signup'),
    p_role_id,
    p_center_id,
    p_max_uses,
    NULLIF(trim(p_note), ''),
    p_expires_at,
    auth.uid()
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$;

ALTER FUNCTION public.admin_create_invitation_link(
  text, integer, bigint, integer, text, timestamptz
) OWNER TO postgres;

COMMIT;
