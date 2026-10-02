CREATE OR REPLACE FUNCTION public.notification_email_target(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE e text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT (
    auth.uid() = _user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _user_id AND n.created_at > now() - interval '2 minutes'
    )
  ) THEN
    RETURN NULL;
  END IF;
  SELECT email INTO e FROM auth.users WHERE id = _user_id;
  RETURN e;
END; $$;

REVOKE ALL ON FUNCTION public.notification_email_target(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_email_target(uuid) TO authenticated;