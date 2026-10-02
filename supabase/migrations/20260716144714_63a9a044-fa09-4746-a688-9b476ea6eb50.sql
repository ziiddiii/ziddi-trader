
CREATE OR REPLACE FUNCTION public.start_autoinvest(_code text, _amount numeric)
 RETURNS autoinvests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.autoinvest_passkeys; bal numeric; has_holdings boolean;
  a public.autoinvests; proj numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  SELECT EXISTS(SELECT 1 FROM public.holdings WHERE user_id = auth.uid()) INTO has_holdings;

  IF NOT has_holdings AND COALESCE(bal,0) <= 0 THEN
    RAISE EXCEPTION 'Buy at least one share or fund your account to unlock Auto Invest';
  END IF;

  SELECT * INTO p FROM public.autoinvest_passkeys WHERE code = upper(trim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid passkey'; END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Passkey is disabled'; END IF;
  IF _amount < p.min_amount THEN RAISE EXCEPTION 'Amount below passkey minimum (KES %)', p.min_amount; END IF;
  IF _amount > p.max_amount THEN RAISE EXCEPTION 'Amount above passkey maximum (KES %)', p.max_amount; END IF;

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
END; $function$;
