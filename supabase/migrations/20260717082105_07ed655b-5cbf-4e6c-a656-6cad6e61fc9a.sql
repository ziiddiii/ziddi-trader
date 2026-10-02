
ALTER TABLE public.withdrawal_tax_settings ADD COLUMN IF NOT EXISTS active_method text NOT NULL DEFAULT 'till' CHECK (active_method IN ('till','paybill'));

CREATE OR REPLACE FUNCTION public.admin_update_tax_settings(
  _tax_percent numeric, _till_number text, _till_business_name text,
  _paybill_number text, _paybill_account text, _instructions text,
  _active_method text DEFAULT 'till'
) RETURNS public.withdrawal_tax_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;
  IF _active_method NOT IN ('till','paybill') THEN _active_method := 'till'; END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions, active_method, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''), coalesce(_instructions,''), _active_method, auth.uid())
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
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;
