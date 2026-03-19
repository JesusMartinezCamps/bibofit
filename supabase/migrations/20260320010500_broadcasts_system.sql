-- Sistema de Difusión para Admin
-- Permite crear mensajes dirigidos a segmentos de usuarios que llegan
-- como notificaciones in-app en tiempo real.

-- ─── Tabla principal de difusiones ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'broadcast'
                CHECK (type IN ('broadcast', 'announcement', 'alert')),

  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Envío
  scheduled_at timestamptz,    -- NULL = envío inmediato al confirmar
  sent_at      timestamptz,    -- se rellena cuando se ejecuta el envío real
  status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')),

  -- Filtros de segmentación (NULL = sin restricción en ese eje)
  filter_roles               text[],    -- ej. ARRAY['free','client']
  filter_subscription_status text[],    -- ej. ARRAY['active','expired']
  filter_center_ids          bigint[],  -- centros específicos (public.centers.id)
  filter_onboarding_done     boolean,   -- true=completados / false=no completados / NULL=todos

  -- Métricas post-envío
  target_count int,   -- usuarios apuntados en el momento del envío
  sent_count   int    -- notificaciones insertadas realmente
);

ALTER TABLE public.broadcasts OWNER TO postgres;

CREATE TRIGGER set_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime();

-- ─── Tabla de destinatarios (auditoría) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broadcast_recipients (
  broadcast_id    bigint NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id         uuid   NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  notification_id bigint REFERENCES public.user_notifications(id) ON DELETE SET NULL,
  PRIMARY KEY (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_recipients OWNER TO postgres;

-- Índice para consultas por usuario (¿qué difusiones me llegaron?)
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_user
  ON public.broadcast_recipients (user_id);

-- ─── RLS broadcasts ────────────────────────────────────────────────────────────

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts"
  ON public.broadcasts
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── RLS broadcast_recipients ──────────────────────────────────────────────────

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read broadcast recipients"
  ON public.broadcast_recipients
  FOR SELECT
  USING (public.is_admin());

-- ─── Grants ────────────────────────────────────────────────────────────────────

GRANT ALL ON TABLE public.broadcasts TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.broadcasts_id_seq TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.broadcast_recipients TO anon, authenticated, service_role;
