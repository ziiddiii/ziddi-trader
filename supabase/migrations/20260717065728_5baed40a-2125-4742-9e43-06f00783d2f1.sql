
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_usernames(_ids uuid[])
RETURNS TABLE(id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username FROM public.profiles p WHERE p.id = ANY(_ids);
$$;

REVOKE ALL ON FUNCTION public.get_usernames(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usernames(uuid[]) TO authenticated, service_role;
