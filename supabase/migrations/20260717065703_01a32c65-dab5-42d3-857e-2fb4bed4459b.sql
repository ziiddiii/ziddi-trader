
-- 1) Tighten profiles SELECT policy: users see only their own row (admins see all)
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2) Expose only non-sensitive columns (id, username) for cross-user lookups (chat, listings)
CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT id, username FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 3) Lock down SECURITY DEFINER function execution: revoke from anon/PUBLIC
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.nspname, r.proname, r.args);
    -- keep authenticated + service_role able to call (admin funcs enforce has_role internally)
    IF r.proname NOT IN ('handle_new_user') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
        r.nspname, r.proname, r.args);
    END IF;
  END LOOP;
END $$;
