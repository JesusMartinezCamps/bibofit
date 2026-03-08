BEGIN;

CREATE TABLE IF NOT EXISTS public.invitation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  destination text NOT NULL DEFAULT 'login'
    CONSTRAINT invitation_links_destination_check CHECK (destination IN ('login')),
  role_id integer NOT NULL REFERENCES public.roles(id),
  center_id bigint REFERENCES public.centers(id) ON DELETE SET NULL,
  max_uses integer
    CONSTRAINT invitation_links_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0),
  used_uses integer NOT NULL DEFAULT 0
    CONSTRAINT invitation_links_used_uses_check CHECK (used_uses >= 0),
  note text,
  expires_at timestamptz,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_links_token_length_check CHECK (char_length(token) >= 24),
  CONSTRAINT invitation_links_usage_bounds_check CHECK (
    max_uses IS NULL OR used_uses <= max_uses
  ),
  CONSTRAINT invitation_links_revocation_consistency_check CHECK (
    (is_revoked = false AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (is_revoked = true AND revoked_at IS NOT NULL)
  )
);

ALTER TABLE public.invitation_links OWNER TO postgres;

CREATE INDEX IF NOT EXISTS invitation_links_created_at_idx
  ON public.invitation_links (created_at DESC);

CREATE INDEX IF NOT EXISTS invitation_links_active_idx
  ON public.invitation_links (is_revoked, expires_at, created_at DESC);

DROP TRIGGER IF EXISTS invitation_links_set_updated_at ON public.invitation_links;
CREATE TRIGGER invitation_links_set_updated_at
  BEFORE UPDATE ON public.invitation_links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invitation_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read invitation links" ON public.invitation_links;
CREATE POLICY "Admin read invitation links"
  ON public.invitation_links
  FOR SELECT
  USING (public.is_admin());

GRANT SELECT ON public.invitation_links TO authenticated;
GRANT ALL ON public.invitation_links TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_invitation_link(
  p_destination text DEFAULT 'login',
  p_role_id integer DEFAULT NULL,
  p_center_id bigint DEFAULT NULL,
  p_max_uses integer DEFAULT 1,
  p_note text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.invitation_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_token text;
  v_invitation public.invitation_links;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create invitation links.';
  END IF;

  IF COALESCE(trim(p_destination), '') <> 'login' THEN
    RAISE EXCEPTION 'Unsupported destination: %', p_destination;
  END IF;

  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = p_role_id
  ) THEN
    RAISE EXCEPTION 'Role not found: %', p_role_id;
  END IF;

  IF p_center_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.centers c
    WHERE c.id = p_center_id
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
    v_token := replace(gen_random_uuid()::text, '-', '')
      || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.invitation_links il
      WHERE il.token = v_token
    );
  END LOOP;

  INSERT INTO public.invitation_links (
    token,
    destination,
    role_id,
    center_id,
    max_uses,
    note,
    expires_at,
    created_by
  )
  VALUES (
    v_token,
    'login',
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
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM anon;
REVOKE ALL ON FUNCTION public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_link(
  text,
  integer,
  bigint,
  integer,
  text,
  timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_revoke_invitation_link(
  p_invitation_link_id uuid
)
RETURNS public.invitation_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

ALTER FUNCTION public.admin_revoke_invitation_link(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_revoke_invitation_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_invitation_link(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_revoke_invitation_link(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_invitation_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_invitation_link(uuid) TO service_role;

COMMIT;
