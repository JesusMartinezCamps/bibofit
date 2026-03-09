BEGIN;

-- Reemplaza la validación de rol en admin_create_invitation_link:
-- En lugar de una lista blanca hardcodeada ('free','client','coach'),
-- simplemente se prohíbe asignar el rol 'admin'.
-- Esto hace el sistema escalable: cualquier rol futuro funciona automáticamente.

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

  -- Solo se bloquea la asignación del rol 'admin' mediante invitación.
  IF lower(v_role_name) = 'admin' THEN
    RAISE EXCEPTION 'Invitations cannot assign the admin role.';
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
