
CREATE TABLE IF NOT EXISTS public.withdrawal_tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_percent numeric NOT NULL DEFAULT 15,
  till_number text NOT NULL DEFAULT '',
  till_business_name text NOT NULL DEFAULT '',
  paybill_number text NOT NULL DEFAULT '',
  paybill_account text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.withdrawal_tax_settings TO authenticated;
GRANT ALL ON public.withdrawal_tax_settings TO service_role;

ALTER TABLE public.withdrawal_tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tax settings"
  ON public.withdrawal_tax_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage tax settings"
  ON public.withdrawal_tax_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.withdrawal_tax_settings (tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions)
SELECT 15, '', '', '', '',
  'Pay the 15% withholding tax using either method below. After payment, share the M-PESA confirmation code with ZiiDi support to release your withdrawal.'
WHERE NOT EXISTS (SELECT 1 FROM public.withdrawal_tax_settings);

CREATE OR REPLACE FUNCTION public.admin_update_tax_settings(
  _tax_percent numeric,
  _till_number text,
  _till_business_name text,
  _paybill_number text,
  _paybill_account text,
  _instructions text
) RETURNS public.withdrawal_tax_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''), coalesce(_instructions,''), auth.uid())
    RETURNING * INTO r;
  ELSE
    UPDATE public.withdrawal_tax_settings SET
      tax_percent = _tax_percent,
      till_number = coalesce(_till_number,''),
      till_business_name = coalesce(_till_business_name,''),
      paybill_number = coalesce(_paybill_number,''),
      paybill_account = coalesce(_paybill_account,''),
      instructions = coalesce(_instructions,''),
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_tax_settings(numeric,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_tax_settings(numeric,text,text,text,text,text) TO authenticated;
