BEGIN;

-- Re-create hash_invitation_token with explicit schema qualification for pgcrypto.
-- pgcrypto is installed in the 'extensions' schema; with search_path = public the
-- bare digest() call is not found. This migration is a no-op on databases where
-- the function is already correct, and fixes local Supabase setups that had the
-- old digest() definition applied before the schema was added.

CREATE OR REPLACE FUNCTION public.hash_invitation_token(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(lower(trim(p_token)), 'sha256'), 'hex');
$$;

ALTER FUNCTION public.hash_invitation_token(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hash_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_invitation_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_invitation_token(text) TO service_role;

COMMIT;
