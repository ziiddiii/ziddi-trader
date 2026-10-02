
CREATE TABLE public.stock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_total numeric NOT NULL DEFAULT 25000,
  max_total numeric NOT NULL DEFAULT 2000000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.stock_settings TO authenticated, anon;
GRANT ALL ON public.stock_settings TO service_role;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read stock settings" ON public.stock_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage stock settings" ON public.stock_settings FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.stock_settings (min_total, max_total) VALUES (25000, 2000000);

CREATE OR REPLACE FUNCTION public.admin_update_stock_settings(_min numeric, _max numeric)
RETURNS public.stock_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.stock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min <= 0 OR _max <= 0 OR _min > _max THEN RAISE EXCEPTION 'Invalid range'; END IF;
  SELECT * INTO r FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.stock_settings (min_total, max_total, updated_by) VALUES (_min, _max, auth.uid()) RETURNING * INTO r;
  ELSE
    UPDATE public.stock_settings SET min_total=_min, max_total=_max, updated_at=now(), updated_by=auth.uid()
      WHERE id=r.id RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_stock_settings(numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_stock_settings(numeric, numeric) TO authenticated;
