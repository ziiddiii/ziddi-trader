-- Fixes "permission denied for function admin_update_tax_settings" on the
-- withdrawal tax settings admin panel. Consolidates the three overloaded
-- versions of admin_update_tax_settings that accumulated across earlier
-- migrations into one definitive signature, and makes sure both admin RPCs
-- are actually callable by authenticated users (the function's own
-- has_role() check — not the grant — is what restricts it to admins).

CREATE TABLE IF NOT EXISTS public.withdrawal_tax_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tax_percent numeric DEFAULT 15 NOT NULL,
    till_number text DEFAULT ''::text NOT NULL,
    till_business_name text DEFAULT ''::text NOT NULL,
    paybill_number text DEFAULT ''::text NOT NULL,
    paybill_account text DEFAULT ''::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    active_method text DEFAULT 'till'::text NOT NULL,
    min_withdrawal numeric DEFAULT 500 NOT NULL,
    max_withdrawal numeric DEFAULT 1000000 NOT NULL,
    tax_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT withdrawal_tax_settings_active_method_check CHECK (active_method = ANY (ARRAY['till'::text, 'paybill'::text]))
);

ALTER TABLE public.withdrawal_tax_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tax settings" ON public.withdrawal_tax_settings;
CREATE POLICY "Anyone can read tax settings" ON public.withdrawal_tax_settings
  FOR SELECT USING (true);

INSERT INTO public.withdrawal_tax_settings (tax_percent)
SELECT 15
WHERE NOT EXISTS (SELECT 1 FROM public.withdrawal_tax_settings);

-- Drop every earlier overload so only one signature remains.
DROP FUNCTION IF EXISTS public.admin_update_tax_settings(numeric, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_tax_settings(numeric, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_tax_settings(numeric, text, text, text, text, text, text, numeric, numeric);

CREATE FUNCTION public.admin_update_tax_settings(
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

GRANT EXECUTE ON FUNCTION public.admin_update_tax_settings(numeric, text, text, text, text, text, text, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_tax_enabled(_enabled boolean)
RETURNS public.withdrawal_tax_settings
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.withdrawal_tax_settings SET tax_enabled = _enabled, updated_at = now()
   WHERE id = (SELECT id FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1) RETURNING * INTO r;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_tax_enabled(boolean) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.withdraw_funds(numeric, text, text) TO authenticated;
