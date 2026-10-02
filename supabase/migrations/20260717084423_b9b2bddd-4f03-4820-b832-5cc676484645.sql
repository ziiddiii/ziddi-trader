
ALTER TABLE public.withdrawal_tax_settings
  ADD COLUMN IF NOT EXISTS min_withdrawal numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS max_withdrawal numeric NOT NULL DEFAULT 1000000;

CREATE OR REPLACE FUNCTION public.admin_update_tax_settings(
  _tax_percent numeric, _till_number text, _till_business_name text,
  _paybill_number text, _paybill_account text, _instructions text,
  _active_method text DEFAULT 'till',
  _min_withdrawal numeric DEFAULT NULL,
  _max_withdrawal numeric DEFAULT NULL
)
RETURNS public.withdrawal_tax_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;
  IF _active_method NOT IN ('till','paybill') THEN _active_method := 'till'; END IF;
  IF _min_withdrawal IS NOT NULL AND _max_withdrawal IS NOT NULL
     AND _min_withdrawal > _max_withdrawal THEN
    RAISE EXCEPTION 'Minimum cannot exceed maximum';
  END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account,
       instructions, active_method, min_withdrawal, max_withdrawal, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''),
            coalesce(_instructions,''), _active_method,
            coalesce(_min_withdrawal, 500), coalesce(_max_withdrawal, 1000000), auth.uid())
    RETURNING * INTO r;
  ELSE
    UPDATE public.withdrawal_tax_settings SET
      tax_percent = _tax_percent,
      till_number = coalesce(_till_number,''),
      till_business_name = coalesce(_till_business_name,''),
      paybill_number = coalesce(_paybill_number,''),
      paybill_account = coalesce(_paybill_account,''),
      instructions = coalesce(_instructions,''),
      active_method = _active_method,
      min_withdrawal = coalesce(_min_withdrawal, r.min_withdrawal),
      max_withdrawal = coalesce(_max_withdrawal, r.max_withdrawal),
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $function$;

CREATE OR REPLACE FUNCTION public.withdraw_funds(_amount numeric, _method text, _destination text)
RETURNS public.withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE bal numeric; w public.withdrawals; s public.withdrawal_tax_settings;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _method NOT IN ('mpesa','bank','card') THEN RAISE EXCEPTION 'Unsupported method'; END IF;
  IF length(coalesce(_destination,'')) < 3 THEN RAISE EXCEPTION 'Destination required'; END IF;

  SELECT * INTO s FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NOT NULL THEN
    IF _amount < s.min_withdrawal THEN
      RAISE EXCEPTION 'Minimum withdrawal is KES %', s.min_withdrawal;
    END IF;
    IF _amount > s.max_withdrawal THEN
      RAISE EXCEPTION 'Maximum withdrawal is KES %', s.max_withdrawal;
    END IF;
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
