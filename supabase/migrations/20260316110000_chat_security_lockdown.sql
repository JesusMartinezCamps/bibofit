-- =============================================================================
-- CHAT SECURITY LOCKDOWN
-- Migration: 20260316110000
-- Objetivo: mantener el chat simple pero endurecido.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Endurecer lectura global y search_path en función crítica
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_can_read_conversation(p_conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comm_conversations c
    WHERE c.id = p_conv_id
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.comm_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = auth.uid()
        )
        OR (c.broadcast_scope = 'all' AND auth.uid() IS NOT NULL)
        OR (c.broadcast_scope = 'coaches' AND public.is_admin_or_coach())
        OR (c.broadcast_scope = 'clients'
            AND NOT public.is_admin_or_coach()
            AND auth.uid() IS NOT NULL)
        OR (c.broadcast_scope = 'coach_clients'
            AND EXISTS (
              SELECT 1 FROM public.coach_clients cc
              WHERE cc.coach_id  = c.created_by
                AND cc.client_id = auth.uid()
            ))
      )
  )
$$;

-- -----------------------------------------------------------------------------
-- 2) RLS update hardening (USING + WITH CHECK)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "comm_part_update" ON public.comm_participants;
CREATE POLICY "comm_part_update"
  ON public.comm_participants FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_msg_update" ON public.comm_messages;
CREATE POLICY "comm_msg_update"
  ON public.comm_messages FOR UPDATE
  USING (sender_id = auth.uid() OR public.is_admin())
  WITH CHECK (sender_id = auth.uid() OR public.is_admin());

-- -----------------------------------------------------------------------------
-- 3) Bloquear cambios de columnas sensibles en UPDATE
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.comm_guard_participants_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.participant_role IS DISTINCT FROM OLD.participant_role
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'Only last_read_at and is_muted can be updated in comm_participants';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comm_guard_participants_update ON public.comm_participants;
CREATE TRIGGER comm_guard_participants_update
  BEFORE UPDATE ON public.comm_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_guard_participants_update();

CREATE OR REPLACE FUNCTION public.comm_guard_messages_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only is_deleted and edited_at can be updated in comm_messages';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comm_guard_messages_update ON public.comm_messages;
CREATE TRIGGER comm_guard_messages_update
  BEFORE UPDATE ON public.comm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_guard_messages_update();

-- -----------------------------------------------------------------------------
-- 4) Anti-abuso mínimo: longitud + rate limit por remitente
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comm_messages_body_length_check'
      AND conrelid = 'public.comm_messages'::regclass
  ) THEN
    ALTER TABLE public.comm_messages
      ADD CONSTRAINT comm_messages_body_length_check
      CHECK (char_length(body) BETWEEN 1 AND 2000);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS comm_messages_sender_created_idx
  ON public.comm_messages(sender_id, created_at DESC)
  WHERE sender_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comm_rate_limit_messages_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_recent_count
  FROM public.comm_messages m
  WHERE m.sender_id = NEW.sender_id
    AND m.created_at >= (now() - INTERVAL '1 minute');

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 20 messages per minute';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comm_rate_limit_messages_insert ON public.comm_messages;
CREATE TRIGGER comm_rate_limit_messages_insert
  BEFORE INSERT ON public.comm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_rate_limit_messages_insert();

-- -----------------------------------------------------------------------------
-- 5) search_path fijo para funciones SECURITY DEFINER del módulo comm_*
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.comm_trig_enroll_new_client_in_coach_channels()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_trig_unenroll_removed_client_from_coach_channels()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_can_read_conversation(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_get_or_create_direct(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_get_or_create_admin_convo()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_can_write_conversation(UUID)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_mark_conversation_read(UUID, TIMESTAMPTZ)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_list_conversations()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_get_unread_total()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.comm_list_conversations_v2()
  SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 6) Ejecutables: cerrar PUBLIC, abrir solo authenticated
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.comm_can_read_conversation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_get_or_create_direct(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_get_or_create_admin_convo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_can_write_conversation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_mark_conversation_read(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_list_conversations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_get_unread_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_list_conversations_v2() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.comm_can_read_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_get_or_create_direct(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_get_or_create_admin_convo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_can_write_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_mark_conversation_read(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_list_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_get_unread_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_list_conversations_v2() TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) Permisos de tabla: comm_messages solo SELECT/INSERT para authenticated
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.comm_messages FROM authenticated;
GRANT SELECT, INSERT ON public.comm_messages TO authenticated;
