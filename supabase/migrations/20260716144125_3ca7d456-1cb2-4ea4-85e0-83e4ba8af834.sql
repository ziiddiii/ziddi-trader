
ALTER TABLE public.autoinvest_passkeys
  ADD COLUMN IF NOT EXISTS max_amount numeric NOT NULL DEFAULT 1000000;

DROP FUNCTION IF EXISTS public.admin_create_passkey(text, numeric, integer, numeric);

CREATE OR REPLACE FUNCTION public.admin_create_passkey(
  _code text, _min_amount numeric, _max_amount numeric,
  _duration_days integer, _return_percent numeric
) RETURNS public.autoinvest_passkeys
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p public.autoinvest_passkeys;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min_amount <= 0 OR _max_amount <= 0 OR _max_amount < _min_amount
     OR _duration_days <= 0 OR _return_percent < 0 THEN
    RAISE EXCEPTION 'Invalid values';
  END IF;
  INSERT INTO public.autoinvest_passkeys
    (code, min_amount, max_amount, duration_days, return_percent, created_by)
  VALUES (upper(trim(_code)), _min_amount, _max_amount, _duration_days, _return_percent, auth.uid())
  RETURNING * INTO p;
  RETURN p;
END; $$;

CREATE OR REPLACE FUNCTION public.start_autoinvest(_code text, _amount numeric)
 RETURNS public.autoinvests
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  p public.autoinvest_passkeys; bal numeric; has_holdings boolean;
  a public.autoinvests; proj numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.holdings WHERE user_id = auth.uid()) INTO has_holdings;
  IF NOT has_holdings THEN RAISE EXCEPTION 'Buy at least one share to unlock Auto Invest'; END IF;

  SELECT * INTO p FROM public.autoinvest_passkeys WHERE code = upper(trim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid passkey'; END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Passkey is disabled'; END IF;
  IF _amount < p.min_amount THEN RAISE EXCEPTION 'Amount below passkey minimum (KES %)', p.min_amount; END IF;
  IF _amount > p.max_amount THEN RAISE EXCEPTION 'Amount above passkey maximum (KES %)', p.max_amount; END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  proj := round((_amount * p.return_percent / 100.0)::numeric, 2);

  INSERT INTO public.autoinvests (user_id, passkey_id, code, principal, return_percent, duration_days, projected_return, matures_at)
  VALUES (auth.uid(), p.id, p.code, _amount, p.return_percent, p.duration_days, proj,
          now() + make_interval(days => p.duration_days))
  RETURNING * INTO a;

  UPDATE public.autoinvest_passkeys SET used_by = auth.uid(), used_at = now()
    WHERE id = p.id AND used_by IS NULL;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'autoinvest', 'Auto Invest started',
    'KES ' || _amount::text || ' auto-invested at ' || p.return_percent::text ||
    '% for ' || p.duration_days::text || ' day(s). Projected return KES ' || proj::text || '.');
  RETURN a;
END; $$;
