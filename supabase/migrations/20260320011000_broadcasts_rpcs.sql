-- RPCs del sistema de Difusión
-- Dos funciones SECURITY DEFINER para que el cliente pueda:
--   1. Previsualizar cuántos usuarios alcanzaría una difusión (sin enviar nada)
--   2. Ejecutar el envío real de una difusión

-- ─── Helper interno: construir lista de destinatarios ─────────────────────────
-- Reutilizado tanto en preview como en send.
-- Devuelve los user_id que cumplen los filtros del broadcast dado.

CREATE OR REPLACE FUNCTION public._broadcast_target_users(p_broadcast_id bigint)
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.user_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  JOIN public.roles r       ON r.id = ur.role_id
  CROSS JOIN (
    SELECT
      filter_roles,
      filter_subscription_status,
      filter_center_ids,
      filter_onboarding_done
    FROM public.broadcasts
    WHERE id = p_broadcast_id
  ) b
  WHERE
    -- Filtro por rol
    (
      b.filter_roles IS NULL
      OR r.role = ANY(b.filter_roles)
    )
    -- Filtro por estado de suscripción
    AND (
      b.filter_subscription_status IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_subscriptions s
        WHERE s.user_id = p.user_id
          AND s.status = ANY(b.filter_subscription_status)
      )
    )
    -- Filtro por centro
    AND (
      b.filter_center_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_centers uc
        WHERE uc.user_id = p.user_id
          AND uc.center_id::text = ANY(
            ARRAY(SELECT fc::text FROM unnest(b.filter_center_ids) AS fc)
          )
      )
    )
    -- Filtro por onboarding completado
    AND (
      b.filter_onboarding_done IS NULL
      OR (b.filter_onboarding_done = (p.onboarding_completed_at IS NOT NULL))
    );
$$;

ALTER FUNCTION public._broadcast_target_users(bigint) OWNER TO postgres;

-- ─── RPC 1: Previsualización ───────────────────────────────────────────────────
-- Devuelve cuántos usuarios recibirían la difusión sin insertar nada.
-- El cliente la llama mientras el admin ajusta los filtros.

CREATE OR REPLACE FUNCTION public.admin_preview_broadcast(p_broadcast_id bigint)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public._broadcast_target_users(p_broadcast_id);

  RETURN v_count;
END;
$$;

ALTER FUNCTION public.admin_preview_broadcast(bigint) OWNER TO postgres;

-- ─── RPC 2: Envío real ─────────────────────────────────────────────────────────
-- Inserta una notificación en user_notifications por cada usuario destino,
-- registra los recipients para auditoría, y marca el broadcast como enviado.
-- Retorna el número de notificaciones insertadas.
--
-- Protecciones:
--   - Solo admins pueden llamarla.
--   - Solo se puede enviar un broadcast en estado 'draft' o 'scheduled'.
--   - Idempotente: si ya fue enviado devuelve el sent_count guardado.

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(p_broadcast_id bigint)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_broadcast   public.broadcasts%ROWTYPE;
  v_user_ids    uuid[];
  v_inserted    int := 0;
  v_notif_ids   bigint[];
BEGIN
  -- Permiso
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  -- Cargar broadcast con lock para evitar doble envío concurrente
  SELECT * INTO v_broadcast
  FROM public.broadcasts
  WHERE id = p_broadcast_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Broadcast % no encontrado', p_broadcast_id;
  END IF;

  -- Idempotencia: si ya fue enviado devolver el count guardado
  IF v_broadcast.status = 'sent' THEN
    RETURN COALESCE(v_broadcast.sent_count, 0);
  END IF;

  IF v_broadcast.status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'No se puede enviar un broadcast en estado "%"', v_broadcast.status;
  END IF;

  -- Obtener destinatarios
  SELECT ARRAY_AGG(user_id) INTO v_user_ids
  FROM public._broadcast_target_users(p_broadcast_id);

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    -- Sin destinatarios: marcar igualmente como enviado
    UPDATE public.broadcasts
    SET status       = 'sent',
        sent_at      = now(),
        target_count = 0,
        sent_count   = 0
    WHERE id = p_broadcast_id;
    RETURN 0;
  END IF;

  -- Insertar notificaciones individuales y capturar sus IDs
  WITH inserted AS (
    INSERT INTO public.user_notifications (user_id, title, message, type)
    SELECT unnest(v_user_ids),
           v_broadcast.title,
           v_broadcast.message,
           v_broadcast.type
    RETURNING id, user_id
  )
  SELECT ARRAY_AGG(id) INTO v_notif_ids FROM inserted;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Registrar recipients para auditoría
  INSERT INTO public.broadcast_recipients (broadcast_id, user_id, notification_id)
  SELECT p_broadcast_id, n.user_id, n.id
  FROM public.user_notifications n
  WHERE n.id = ANY(v_notif_ids);

  -- Actualizar estado del broadcast
  UPDATE public.broadcasts
  SET status       = 'sent',
      sent_at      = now(),
      target_count = array_length(v_user_ids, 1),
      sent_count   = v_inserted
  WHERE id = p_broadcast_id;

  RETURN v_inserted;
END;
$$;

ALTER FUNCTION public.admin_send_broadcast(bigint) OWNER TO postgres;

-- ─── RPC 3: Cancelar difusión programada ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_cancel_broadcast(p_broadcast_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  UPDATE public.broadcasts
  SET status = 'cancelled'
  WHERE id = p_broadcast_id
    AND status IN ('draft', 'scheduled');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se puede cancelar: broadcast % no existe o ya fue enviado', p_broadcast_id;
  END IF;
END;
$$;

ALTER FUNCTION public.admin_cancel_broadcast(bigint) OWNER TO postgres;

-- ─── Grants para las funciones ────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public._broadcast_target_users(bigint)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_preview_broadcast(bigint)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(bigint)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_broadcast(bigint)        TO authenticated, service_role;
