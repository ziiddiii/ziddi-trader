CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.guard_not_suspended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Your account has been suspended. Please contact ZiiDi Trader support.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deposits','withdrawals','holdings','investments','lock_deposits','autoinvests','messages','support_messages','kyc_verifications','listings','disputes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_suspended_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER guard_suspended_%1$s BEFORE INSERT OR UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended()', t);
  END LOOP;
END $$;