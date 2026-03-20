-- Permite que sender_id se anule por ON DELETE SET NULL (cascade al borrar un perfil)
-- El trigger bloqueaba delete_user_complete porque la FK comm_messages_sender_id_fkey
-- intentaba hacer SET NULL al borrar el perfil, y el guard no lo permitía.

CREATE OR REPLACE FUNCTION "public"."comm_guard_messages_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- sender_id puede pasar a NULL (ON DELETE SET NULL por cascade), pero no cambiarse a otro valor
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR (NEW.sender_id IS DISTINCT FROM OLD.sender_id AND NEW.sender_id IS NOT NULL)
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only is_deleted and edited_at can be updated in comm_messages';
  END IF;

  RETURN NEW;
END;
$$;
