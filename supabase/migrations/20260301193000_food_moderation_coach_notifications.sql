-- Enable coach moderation of foods for assigned clients and allow admin/coach
-- to emit in-app notifications for moderated users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food'
      AND policyname = 'Coaches can update client foods'
  ) THEN
    CREATE POLICY "Coaches can update client foods"
    ON public.food
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid()
          AND cc.client_id = food.user_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid()
          AND cc.client_id = food.user_id
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food'
      AND policyname = 'Coaches can delete client foods'
  ) THEN
    CREATE POLICY "Coaches can delete client foods"
    ON public.food
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid()
          AND cc.client_id = food.user_id
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_notifications'
      AND policyname = 'Admins and coaches can insert managed notifications'
  ) THEN
    CREATE POLICY "Admins and coaches can insert managed notifications"
    ON public.user_notifications
    FOR INSERT
    WITH CHECK (
      public.is_admin()
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid()
          AND cc.client_id = user_notifications.user_id
      )
    );
  END IF;
END $$;
