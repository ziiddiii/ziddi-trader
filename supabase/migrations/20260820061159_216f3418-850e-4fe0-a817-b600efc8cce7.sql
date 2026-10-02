-- 1. Restrict which profile columns a user may self-update
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, phone) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'Balance cannot be modified directly';
    END IF;
    IF COALESCE(NEW.suspended,false) IS DISTINCT FROM COALESCE(OLD.suspended,false) THEN
      RAISE EXCEPTION 'Suspension status cannot be modified directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 2. Revoke EXECUTE on server-only SECURITY DEFINER settlement helpers
REVOKE ALL ON FUNCTION public.settle_crypto_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_crypto_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_stk_deposit(text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stk_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_pending_and_notify() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_crypto_deposit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_crypto_deposit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_stk_deposit(text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stk_deposit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_and_notify() TO service_role;

-- 3. autoinvests: explicit admin-only write policies (user writes go through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Admins manage autoinvests" ON public.autoinvests;
CREATE POLICY "Admins manage autoinvests" ON public.autoinvests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete autoinvests" ON public.autoinvests;
CREATE POLICY "Admins delete autoinvests" ON public.autoinvests
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins insert autoinvests" ON public.autoinvests;
CREATE POLICY "Admins insert autoinvests" ON public.autoinvests
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. lock_deposits: admin-only update/delete
DROP POLICY IF EXISTS "Admins update locks" ON public.lock_deposits;
CREATE POLICY "Admins update locks" ON public.lock_deposits
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete locks" ON public.lock_deposits;
CREATE POLICY "Admins delete locks" ON public.lock_deposits
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- 5. kyc_verifications: explicit admin-only delete
DROP POLICY IF EXISTS "Admins delete kyc" ON public.kyc_verifications;
CREATE POLICY "Admins delete kyc" ON public.kyc_verifications
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- 6. Realtime-published financial tables: keep reads owner/admin scoped, block anon entirely
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.deposits FROM anon;
GRANT UPDATE (username, phone) ON public.profiles TO authenticated;
