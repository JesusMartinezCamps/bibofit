-- =============================================================================
-- COMMUNICATION CENTER - INBOX V2 (direct profile fields)
-- Migration: 20260308154000
-- =============================================================================
-- Motivo:
-- Clientes no siempre pueden leer perfiles de otros usuarios por RLS (ej. admin),
-- lo que provoca fallback "Usuario" en chats directos.
-- Esta función devuelve datos del "otro usuario" en el propio RPC de bandeja.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_list_conversations_v2()
RETURNS TABLE (
  id UUID,
  type TEXT,
  name TEXT,
  description TEXT,
  broadcast_scope TEXT,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  my_role TEXT,
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER,
  other_user_id UUID,
  other_full_name TEXT,
  other_first_name TEXT,
  other_last_name TEXT,
  other_avatar_url TEXT,
  other_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
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

ALTER FUNCTION public.comm_list_conversations_v2() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.comm_list_conversations_v2() TO authenticated;
