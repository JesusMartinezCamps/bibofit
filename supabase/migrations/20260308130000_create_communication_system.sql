-- =============================================================================
-- COMMUNICATION CENTER — Centro de Comunicaciones
-- Migration: 20260308130000
-- =============================================================================
-- Diseño bidireccional y escalable para soportar ahora y en el futuro:
--
--  AHORA:
--   · Canales de novedades: coach → sus clientes (broadcast unidireccional)
--   · Canal global:        admin  → todos / coaches / clientes
--   · Chat directo 1:1:   coach ↔ cliente, usuario ↔ admin
--
--  FUTURO (sin reescribir nada):
--   · Chats entre amigos (direct entre cualquier par de usuarios)
--   · Grupos de amigos (type = 'group', sin broadcast_scope)
--   · Compartir recetas/dietas (message.type = 'recipe_share' | 'diet_share')
--   · Reacciones a mensajes (tabla comm_message_reactions a añadir)
--   · Adjuntos / imágenes  (message.metadata.attachment_url)
--
-- TABLAS:
--   comm_conversations  — hilo/canal de comunicación
--   comm_participants   — quién está en cada conversación (roles de acceso)
--   comm_messages       — mensajes individuales con tipos extensibles
--
-- FUNCIONES:
--   comm_get_or_create_direct(other_user_id)  — chat 1:1 idempotente
--   comm_get_or_create_admin_convo()          — "contactar con el admin"
--   comm_create_channel(name, desc, scope)    — canal de novedades
--   comm_can_read_conversation(conv_id)       — helper RLS
--
-- TRIGGERS:
--   Al insertar mensaje → actualiza conversations.updated_at
--   Al añadir coach_client → auto-enrolla cliente en canales del coach
--   Al eliminar coach_client → desinscribe cliente de canales del coach
-- =============================================================================


-- =============================================================================
-- TABLE: comm_conversations
-- =============================================================================
-- type:
--   'direct'  → conversación 1:1 entre dos usuarios
--   'channel' → canal de difusión (solo el owner puede escribir)
--   'group'   → grupo de varios usuarios con escritura abierta (futuro)
--
-- broadcast_scope (solo aplica a channels):
--   NULL             → solo participantes explícitos ven este canal
--   'all'            → todos los usuarios autenticados
--   'coaches'        → todos los coaches (admin o coach)
--   'clients'        → todos los clientes/free
--   'coach_clients'  → solo los clientes asignados al coach creador
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.comm_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT        NOT NULL DEFAULT 'direct'
                              CONSTRAINT comm_conversations_type_check
                              CHECK (type IN ('direct', 'channel', 'group')),
  name            TEXT,                        -- título del canal/grupo
  description     TEXT,                        -- descripción opcional
  created_by      UUID        NOT NULL
                              REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  broadcast_scope TEXT
                              CONSTRAINT comm_conversations_broadcast_scope_check
                              CHECK (broadcast_scope IN ('all', 'coaches', 'clients', 'coach_clients')),
  is_archived     BOOLEAN     NOT NULL DEFAULT false,
  metadata        JSONB,                       -- extensible: imagen de grupo, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                                               -- actualizado por trigger al llegar mensaje
);

ALTER TABLE public.comm_conversations OWNER TO postgres;

COMMENT ON TABLE  public.comm_conversations IS 'Hilos de conversación del Centro de Comunicaciones';
COMMENT ON COLUMN public.comm_conversations.broadcast_scope IS
  'NULL=participantes explícitos | all=todos | coaches=coaches | clients=clientes | coach_clients=clientes del coach creador';


-- =============================================================================
-- TABLE: comm_participants
-- =============================================================================
-- Registra quién participa de forma explícita en una conversación y con qué rol.
-- Para canales con broadcast_scope, los destinatarios implícitos NO necesitan
-- fila aquí (el acceso se controla vía RLS + broadcast_scope).
-- El creador/owner siempre tiene fila aquí con participant_role = 'owner'.
--
-- participant_role:
--   'owner'    → creó la conversación, puede escribir y administrar
--   'member'   → participante con escritura (directs y grupos)
--   'readonly' → puede leer pero no escribir (suscriptores de canales con
--                participantes explícitos, e.g. canal privado sin scope)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.comm_participants (
  id               BIGINT      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  conversation_id  UUID        NOT NULL
                               REFERENCES public.comm_conversations(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL
                               REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  participant_role TEXT        NOT NULL DEFAULT 'member'
                               CONSTRAINT comm_participants_role_check
                               CHECK (participant_role IN ('owner', 'member', 'readonly')),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at     TIMESTAMPTZ,               -- mensajes posteriores a esto = no leídos
  is_muted         BOOLEAN     NOT NULL DEFAULT false,  -- futuramente: silenciar notificaciones
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.comm_participants OWNER TO postgres;

COMMENT ON TABLE  public.comm_participants IS 'Participantes explícitos en conversaciones del Communication Center';
COMMENT ON COLUMN public.comm_participants.last_read_at IS 'Timestamp del último mensaje leído; todo lo posterior cuenta como no leído';

CREATE INDEX IF NOT EXISTS comm_participants_user_id_idx
  ON public.comm_participants(user_id);

CREATE INDEX IF NOT EXISTS comm_participants_conversation_id_idx
  ON public.comm_participants(conversation_id);


-- =============================================================================
-- TABLE: comm_messages
-- =============================================================================
-- sender_id NULL → mensaje de sistema (e.g. "Juan se unió al canal")
--
-- type:
--   'text'          → mensaje de texto plano
--   'system'        → mensaje automático del sistema
--   'announcement'  → anuncio importante de admin/coach (estilo destacado en UI)
--   'recipe_share'  → receta compartida  → metadata: { recipe_id, recipe_name }
--   'diet_share'    → dieta compartida   → metadata: { diet_plan_id, diet_plan_name }
--
-- metadata JSONB permite añadir nuevos tipos de contenido sin alterar la tabla.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.comm_messages (
  id               BIGINT      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  conversation_id  UUID        NOT NULL
                               REFERENCES public.comm_conversations(id) ON DELETE CASCADE,
  sender_id        UUID
                               REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  body             TEXT        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'text'
                               CONSTRAINT comm_messages_type_check
                               CHECK (type IN ('text', 'system', 'announcement', 'recipe_share', 'diet_share')),
  metadata         JSONB,                     -- { recipe_id, diet_plan_id, attachment_url, ... }
  is_deleted       BOOLEAN     NOT NULL DEFAULT false,   -- soft-delete: ocultar sin borrar
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at        TIMESTAMPTZ                -- NULL = nunca editado
);

ALTER TABLE public.comm_messages OWNER TO postgres;

COMMENT ON TABLE  public.comm_messages IS 'Mensajes del Centro de Comunicaciones';
COMMENT ON COLUMN public.comm_messages.type IS 'text | system | announcement | recipe_share | diet_share';
COMMENT ON COLUMN public.comm_messages.metadata IS 'JSON extensible: recipe_id, diet_plan_id, attachment_url, etc.';

-- Índices para paginación y búsqueda eficiente
CREATE INDEX IF NOT EXISTS comm_messages_conversation_created_idx
  ON public.comm_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS comm_messages_sender_id_idx
  ON public.comm_messages(sender_id);


-- =============================================================================
-- TRIGGER: actualizar conversations.updated_at al insertar mensaje
-- Permite ordenar la bandeja por actividad reciente
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_trig_update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.comm_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.comm_trig_update_conversation_timestamp() OWNER TO postgres;

DROP TRIGGER IF EXISTS comm_messages_update_conversation_ts ON public.comm_messages;
CREATE TRIGGER comm_messages_update_conversation_ts
  AFTER INSERT ON public.comm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_trig_update_conversation_timestamp();


-- =============================================================================
-- TRIGGER: al crear una relación coach_client, inscribir automáticamente
-- al cliente como readonly en todos los canales activos del coach
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_trig_enroll_new_client_in_coach_channels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  SELECT c.id, NEW.client_id, 'readonly'
  FROM public.comm_conversations c
  WHERE c.created_by  = NEW.coach_id
    AND c.type        = 'channel'
    AND c.broadcast_scope = 'coach_clients'
    AND c.is_archived = false
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.comm_trig_enroll_new_client_in_coach_channels() OWNER TO postgres;

DROP TRIGGER IF EXISTS comm_coach_clients_enroll_new_client ON public.coach_clients;
CREATE TRIGGER comm_coach_clients_enroll_new_client
  AFTER INSERT ON public.coach_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_trig_enroll_new_client_in_coach_channels();


-- =============================================================================
-- TRIGGER: al eliminar una relación coach_client, desinscribir al cliente
-- de los canales readonly del coach (no afecta a chats directos)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_trig_unenroll_removed_client_from_coach_channels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.comm_participants cp
  USING public.comm_conversations c
  WHERE cp.conversation_id  = c.id
    AND cp.user_id           = OLD.client_id
    AND cp.participant_role  = 'readonly'
    AND c.created_by         = OLD.coach_id
    AND c.type               = 'channel'
    AND c.broadcast_scope    = 'coach_clients';
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.comm_trig_unenroll_removed_client_from_coach_channels() OWNER TO postgres;

DROP TRIGGER IF EXISTS comm_coach_clients_unenroll_client ON public.coach_clients;
CREATE TRIGGER comm_coach_clients_unenroll_client
  AFTER DELETE ON public.coach_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_trig_unenroll_removed_client_from_coach_channels();


-- =============================================================================
-- FUNCTION: comm_can_read_conversation(conv_id)
-- Helper usado en las políticas RLS de mensajes y conversaciones.
-- Un usuario puede leer si:
--   · Es admin (ve todo)
--   · Está en comm_participants de esa conversación
--   · La conversación tiene broadcast_scope que le corresponde por rol
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_can_read_conversation(p_conv_id UUID)
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
        -- Admin ve todo
        public.is_admin()

        -- Participante explícito
        OR EXISTS (
          SELECT 1 FROM public.comm_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = auth.uid()
        )

        -- broadcast_scope = 'all' → cualquier usuario autenticado
        OR c.broadcast_scope = 'all'

        -- broadcast_scope = 'coaches' → admin y coaches
        OR (c.broadcast_scope = 'coaches' AND public.is_admin_or_coach())

        -- broadcast_scope = 'clients' → clientes y free (no coaches, no admin)
        OR (c.broadcast_scope = 'clients'
            AND NOT public.is_admin_or_coach()
            AND auth.uid() IS NOT NULL)

        -- broadcast_scope = 'coach_clients' → clientes asignados al coach creador
        OR (c.broadcast_scope = 'coach_clients'
            AND EXISTS (
              SELECT 1 FROM public.coach_clients cc
              WHERE cc.coach_id  = c.created_by
                AND cc.client_id = auth.uid()
            ))
      )
  )
$$;

ALTER FUNCTION public.comm_can_read_conversation(UUID) OWNER TO postgres;


-- =============================================================================
-- FUNCTION: comm_get_or_create_direct(p_other_user_id)
-- Obtiene o crea una conversación directa entre el usuario actual y otro.
-- Idempotente y segura ante condiciones de carrera (ON CONFLICT).
-- Uso: desde el frontend para abrir/continuar un chat 1:1.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_get_or_create_direct(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  -- Buscar conversación directa existente entre los dos usuarios
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

  -- Crear nueva conversación directa
  INSERT INTO public.comm_conversations (type, created_by)
  VALUES ('direct', v_caller_id)
  RETURNING id INTO v_conversation_id;

  -- Inscribir a los dos participantes como 'member'
  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  VALUES
    (v_conversation_id, v_caller_id,    'member'),
    (v_conversation_id, p_other_user_id, 'member');

  RETURN v_conversation_id;
END;
$$;

ALTER FUNCTION public.comm_get_or_create_direct(UUID) OWNER TO postgres;

COMMENT ON FUNCTION public.comm_get_or_create_direct(UUID) IS
  'Crea o devuelve la conversación directa entre el usuario actual y p_other_user_id';


-- =============================================================================
-- FUNCTION: comm_get_or_create_admin_convo()
-- Obtiene o crea el chat directo del usuario actual con un admin.
-- Útil para el botón "Contactar con el admin" visible desde cualquier rol.
-- Si hay varios admins, se usa el primero encontrado (puede refinarse).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_get_or_create_admin_convo()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Encontrar el primer admin disponible
  SELECT ur.user_id INTO v_admin_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found in the system';
  END IF;

  IF v_caller_id = v_admin_id THEN
    RAISE EXCEPTION 'You are the admin';
  END IF;

  -- Reutilizar la función genérica de direct
  RETURN public.comm_get_or_create_direct(v_admin_id);
END;
$$;

ALTER FUNCTION public.comm_get_or_create_admin_convo() OWNER TO postgres;

COMMENT ON FUNCTION public.comm_get_or_create_admin_convo() IS
  'Crea o devuelve el chat directo entre el usuario actual y el admin del sistema';


-- =============================================================================
-- FUNCTION: comm_create_channel(name, description, broadcast_scope)
-- Crea un canal de novedades/broadcast.
-- Permisos según scope:
--   'all' | 'coaches' | 'clients'  → solo admin puede crear
--   'coach_clients'                → admin o coach puede crear
--   NULL (canal privado)           → cualquier usuario autenticado
-- Si scope = 'coach_clients', auto-inscribe a todos los clientes actuales
-- del coach como 'readonly'.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.comm_create_channel(
  p_name           TEXT,
  p_description    TEXT    DEFAULT NULL,
  p_broadcast_scope TEXT   DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id       UUID := auth.uid();
  v_conversation_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validar permisos según scope
  IF p_broadcast_scope IN ('all', 'coaches', 'clients') THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo el admin puede crear canales globales (scope: %)', p_broadcast_scope;
    END IF;
  END IF;

  IF p_broadcast_scope = 'coach_clients' THEN
    IF NOT public.is_admin_or_coach() THEN
      RAISE EXCEPTION 'Solo admins y coaches pueden crear canales para sus clientes';
    END IF;
  END IF;

  -- Crear la conversación tipo canal
  INSERT INTO public.comm_conversations (type, name, description, created_by, broadcast_scope)
  VALUES ('channel', p_name, p_description, v_caller_id, p_broadcast_scope)
  RETURNING id INTO v_conversation_id;

  -- El creador es siempre 'owner'
  INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
  VALUES (v_conversation_id, v_caller_id, 'owner');

  -- Si es canal de clientes del coach, inscribir a todos sus clientes actuales
  IF p_broadcast_scope = 'coach_clients' THEN
    INSERT INTO public.comm_participants (conversation_id, user_id, participant_role)
    SELECT v_conversation_id, cc.client_id, 'readonly'
    FROM public.coach_clients cc
    WHERE cc.coach_id = v_caller_id
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;

ALTER FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT) IS
  'Crea un canal de novedades. broadcast_scope: all | coaches | clients | coach_clients | NULL';


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.comm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_messages       ENABLE ROW LEVEL SECURITY;


-- --- comm_conversations ---

DROP POLICY IF EXISTS "comm_conv_select" ON public.comm_conversations;
CREATE POLICY "comm_conv_select"
  ON public.comm_conversations FOR SELECT
  USING (public.comm_can_read_conversation(id));

DROP POLICY IF EXISTS "comm_conv_insert" ON public.comm_conversations;
CREATE POLICY "comm_conv_insert"
  ON public.comm_conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "comm_conv_update" ON public.comm_conversations;
CREATE POLICY "comm_conv_update"
  ON public.comm_conversations FOR UPDATE
  USING (
    public.is_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "comm_conv_delete" ON public.comm_conversations;
CREATE POLICY "comm_conv_delete"
  ON public.comm_conversations FOR DELETE
  USING (public.is_admin() OR created_by = auth.uid());


-- --- comm_participants ---

DROP POLICY IF EXISTS "comm_part_select" ON public.comm_participants;
CREATE POLICY "comm_part_select"
  ON public.comm_participants FOR SELECT
  USING (
    -- El propio usuario ve sus participaciones
    user_id = auth.uid()
    -- Admin ve todo
    OR public.is_admin()
    -- El owner de una conversación ve su lista de participantes
    OR EXISTS (
      SELECT 1 FROM public.comm_conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comm_part_insert" ON public.comm_participants;
CREATE POLICY "comm_part_insert"
  ON public.comm_participants FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.comm_conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "comm_part_update" ON public.comm_participants;
CREATE POLICY "comm_part_update"
  ON public.comm_participants FOR UPDATE
  -- Solo el propio usuario puede actualizar sus metadatos (last_read_at, is_muted)
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_part_delete" ON public.comm_participants;
CREATE POLICY "comm_part_delete"
  ON public.comm_participants FOR DELETE
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.comm_conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );


-- --- comm_messages ---

DROP POLICY IF EXISTS "comm_msg_select" ON public.comm_messages;
CREATE POLICY "comm_msg_select"
  ON public.comm_messages FOR SELECT
  USING (public.comm_can_read_conversation(conversation_id));

DROP POLICY IF EXISTS "comm_msg_insert" ON public.comm_messages;
CREATE POLICY "comm_msg_insert"
  ON public.comm_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Admin puede escribir en cualquier conversación que pueda leer
      public.is_admin()

      -- Participante con rol owner o member en una conversación directa/grupo
      OR EXISTS (
        SELECT 1 FROM public.comm_participants cp
        WHERE cp.conversation_id = comm_messages.conversation_id
          AND cp.user_id = auth.uid()
          AND cp.participant_role IN ('owner', 'member')
      )

      -- Owner de un canal broadcast puede publicar en él
      OR EXISTS (
        SELECT 1 FROM public.comm_conversations c
        WHERE c.id = comm_messages.conversation_id
          AND c.created_by = auth.uid()
          AND c.type = 'channel'
      )
    )
  );

DROP POLICY IF EXISTS "comm_msg_update" ON public.comm_messages;
CREATE POLICY "comm_msg_update"
  -- Solo el remitente puede editar/soft-delete su propio mensaje
  ON public.comm_messages FOR UPDATE
  USING (sender_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "comm_msg_delete" ON public.comm_messages;
CREATE POLICY "comm_msg_delete"
  -- Hard-delete solo para admin (los usuarios hacen soft-delete via UPDATE)
  ON public.comm_messages FOR DELETE
  USING (public.is_admin());


-- =============================================================================
-- GRANTS para usuarios autenticados
-- =============================================================================

GRANT SELECT, INSERT, UPDATE        ON public.comm_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comm_participants  TO authenticated;
GRANT SELECT, INSERT, UPDATE        ON public.comm_messages       TO authenticated;

GRANT EXECUTE ON FUNCTION public.comm_get_or_create_direct(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_get_or_create_admin_convo()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_create_channel(TEXT, TEXT, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.comm_can_read_conversation(UUID)         TO authenticated;
