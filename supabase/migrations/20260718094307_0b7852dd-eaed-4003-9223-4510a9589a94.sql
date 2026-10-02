
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  username text,
  balance numeric,
  suspended boolean,
  email text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.balance, COALESCE(p.suspended, false) AS suspended,
         u.email::text, u.phone::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated, service_role;
