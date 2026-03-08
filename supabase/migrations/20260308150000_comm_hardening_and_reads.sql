-- =============================================================================
-- COMMUNICATION CENTER HARDENING + READ STATE
-- Migration: 20260308150000
-- =============================================================================
-- Objetivos:
-- 1) Blindar concurrencia en chats directos (idempotencia real).
-- 2) Añadir estado de lectura para miembros implícitos (broadcast_scope global).
-- 3) Exponer RPC para bandeja y contador no leído desde SQL.
-- 4) Endurecer permisos de escritura por tipo de conversación.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: comm_user_reads
-- Estado de lectura para usuarios que ven una conversación sin fila explícita en
-- comm_participants (ej. canales globales all/coaches/clients).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comm_user_reads (
  conversation_id UUID        NOT NULL
                  REFERENCES public.comm_conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL
                  REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.comm_user_reads OWNER TO postgres;

CREATE INDEX IF NOT EXISTS comm_user_reads_user_id_idx
  ON public.comm_user_reads(user_id);

ALTER TABLE public.comm_user_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comm_user_reads_select" ON public.comm_user_reads;
CREATE POLICY "comm_user_reads_select"
  ON public.comm_user_reads FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_user_reads_insert" ON public.comm_user_reads;
CREATE POLICY "comm_user_reads_insert"
  ON public.comm_user_reads FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_user_reads_update" ON public.comm_user_reads;
CREATE POLICY "comm_user_reads_update"
  ON public.comm_user_reads FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_user_reads_delete" ON public.comm_user_reads;
CREATE POLICY "comm_user_reads_delete"
  ON public.comm_user_reads FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_user_reads TO authenticated;


-- -----------------------------------------------------------------------------
-- FUNCTION: comm_get_or_create_direct(other_user_id)
-- Versión hardened con advisory lock por pareja ordenada de usuarios.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_get_or_create_direct(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_conversation_id UUID;
  v_user_a          TEXT;
  v_user_b          TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  -- Orden estable para ambos lados del chat y lock de transacción.
  v_user_a := LEAST(v_caller_id::TEXT, p_other_user_id::TEXT);
  v_user_b := GREATEST(v_caller_id::TEXT, p_other_user_id::TEXT);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_a || ':' || v_user_b, 0));

  -- Re-check tras lock para evitar duplicados por carrera.
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM public.comm_participants cp1
  JOIN public.comm_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN public.comm_conversations c
    ON c.id = cp1.conversation_id
  WHERE cp1.user_id = v_caller_id
    AND cp2.user_id = p_other_user_id
    AND c.type = 'direct'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO public.comm_conversations (type, created_by)
  VALUES ('direct', v_caller_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  VALUES
    (v_conversation_id, v_caller_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member');

  RETURN v_conversation_id;
END;
$$;

ALTER FUNCTION public.comm_get_or_create_direct(UUID) OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- FUNCTION: comm_can_write_conversation(conv_id)
-- Reglas únicas de escritura en backend:
-- - admin: puede escribir
-- - channel: solo owner (created_by)
-- - direct/group: owner/member explícito
-- - conversación archivada: nadie salvo admin (incluido arriba)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_can_write_conversation(p_conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comm_conversations c
    WHERE c.id = p_conv_id
      AND (
        public.is_admin()
        OR (
          c.is_archived = false
          AND (
            (c.type = 'channel' AND c.created_by = auth.uid())
            OR (
              c.type IN ('direct', 'group')
              AND EXISTS (
                SELECT 1
                FROM public.comm_participants cp
                WHERE cp.conversation_id = c.id
                  AND cp.user_id = auth.uid()
                  AND cp.participant_role IN ('owner', 'member')
              )
            )
          )
        )
      )
  );
$$;

ALTER FUNCTION public.comm_can_write_conversation(UUID) OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- FUNCTION: comm_mark_conversation_read(conv_id, read_at)
-- Marca conversación como leída.
-- - Si hay fila explícita en comm_participants: actualiza ahí.
-- - Si es miembro implícito (broadcast/global/admin visibility): usa comm_user_reads.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_mark_conversation_read(
  p_conv_id UUID,
  p_read_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_read_at TIMESTAMPTZ := COALESCE(p_read_at, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.comm_can_read_conversation(p_conv_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.comm_participants
  SET last_read_at = GREATEST(COALESCE(last_read_at, 'epoch'::timestamptz), v_read_at)
  WHERE conversation_id = p_conv_id
    AND user_id = v_user_id;

  IF FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.comm_user_reads (conversation_id, user_id, last_read_at, updated_at)
  VALUES (p_conv_id, v_user_id, v_read_at, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    last_read_at = GREATEST(public.comm_user_reads.last_read_at, EXCLUDED.last_read_at),
    updated_at = now();
END;
$$;

ALTER FUNCTION public.comm_mark_conversation_read(UUID, TIMESTAMPTZ) OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- FUNCTION: comm_list_conversations()
-- Fuente única para bandeja + unread_count por conversación.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_list_conversations()
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
  other_user_id UUID
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
    CASE
      WHEN v.type = 'direct' THEN (
        SELECT cp2.user_id
        FROM public.comm_participants cp2
        WHERE cp2.conversation_id = v.id
          AND cp2.user_id <> auth.uid()
        ORDER BY cp2.id
        LIMIT 1
      )
      ELSE NULL
    END AS other_user_id
  FROM visible v
  LEFT JOIN my_part mp ON mp.conversation_id = v.id
  LEFT JOIN my_reads mr ON mr.conversation_id = v.id
  ORDER BY v.updated_at DESC;
$$;

ALTER FUNCTION public.comm_list_conversations() OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- FUNCTION: comm_get_unread_total()
-- Total agregado de unread para badge global.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_get_unread_total()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(SUM(t.unread_count), 0)::INTEGER
  FROM public.comm_list_conversations() t;
$$;

ALTER FUNCTION public.comm_get_unread_total() OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- POLICY HARDENING: comm_messages INSERT
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "comm_msg_insert" ON public.comm_messages;
CREATE POLICY "comm_msg_insert"
  ON public.comm_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.comm_can_write_conversation(comm_messages.conversation_id)
  );


-- -----------------------------------------------------------------------------
-- GRANTS (authenticated)
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.comm_can_write_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_mark_conversation_read(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_list_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_get_unread_total() TO authenticated;
