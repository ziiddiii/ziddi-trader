ALTER TABLE public.withdrawal_tax_settings ADD COLUMN IF NOT EXISTS tax_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tax_tx_code text;

CREATE OR REPLACE FUNCTION public.submit_withdrawal_tax_code(_id uuid, _code text)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals; c text := upper(trim(coalesce(_code,''))); a record;
BEGIN
  IF c !~ '^[A-Z0-9]{8,12}$' THEN RAISE EXCEPTION 'Enter a valid transaction code (8-12 letters/numbers)'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  UPDATE public.withdrawals SET tax_tx_code = c, tax_paid_at = now() WHERE id = _id RETURNING * INTO w;
  INSERT INTO public.notifications (user_id, kind, title, body) VALUES (w.user_id, 'withdrawal', 'MMF tax code submitted',
    'Your tax payment code ' || c || ' for the KES ' || w.amount::text || ' withdrawal is pending verification.');
  FOR a IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body) VALUES (a.user_id, 'withdrawal', 'MMF tax code submitted',
      'Code ' || c || ' for ' || w.method || ' withdrawal of KES ' || w.amount::text || '. Verify and approve.');
  END LOOP;
  RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.submit_withdrawal_tax_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_tax_code(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_tax_enabled(_enabled boolean)
RETURNS public.withdrawal_tax_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.withdrawal_tax_settings SET tax_enabled = _enabled, updated_at = now()
   WHERE id = (SELECT id FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_tax_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_tax_enabled(boolean) TO authenticated;