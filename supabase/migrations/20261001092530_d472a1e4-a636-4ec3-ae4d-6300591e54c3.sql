CREATE OR REPLACE FUNCTION public.withdraw_funds(_amount numeric, _method text, _destination text)
 RETURNS withdrawals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE bal numeric; w public.withdrawals; s public.withdrawal_tax_settings; eff_min numeric := 100000;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _method NOT IN ('mpesa','bank','card') THEN RAISE EXCEPTION 'Unsupported method'; END IF;
  IF length(coalesce(_destination,'')) < 3 THEN RAISE EXCEPTION 'Destination required'; END IF;

  SELECT * INTO s FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NOT NULL THEN eff_min := GREATEST(100000, s.min_withdrawal); END IF;
  IF _amount < eff_min THEN
    RAISE EXCEPTION 'Minimum withdrawal is KES %', to_char(eff_min, 'FM999,999,999');
  END IF;
  IF s.id IS NOT NULL AND _amount > s.max_withdrawal THEN
    RAISE EXCEPTION 'Maximum withdrawal is KES %', to_char(s.max_withdrawal, 'FM999,999,999');
  END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.withdrawals (user_id, amount, method, destination, status)
    VALUES (auth.uid(), _amount, _method, _destination, 'pending')
    RETURNING * INTO w;
  INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (auth.uid(), 'withdrawal', 'Withdrawal submitted',
      'Your ' || _method || ' withdrawal of KES ' || _amount::text || ' is pending admin approval.');
  RETURN w;
END; $function$;