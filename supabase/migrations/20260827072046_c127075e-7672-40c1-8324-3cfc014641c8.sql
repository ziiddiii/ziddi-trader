GRANT INSERT ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "own notifications insert" ON public.notifications;
CREATE POLICY "own notifications insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());