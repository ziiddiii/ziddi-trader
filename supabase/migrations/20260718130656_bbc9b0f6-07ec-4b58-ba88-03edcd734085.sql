
CREATE TABLE public.promo_flashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_flashes TO anon, authenticated;
GRANT ALL ON public.promo_flashes TO authenticated;
GRANT ALL ON public.promo_flashes TO service_role;
ALTER TABLE public.promo_flashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read enabled promos" ON public.promo_flashes FOR SELECT USING (true);
CREATE POLICY "Admins manage promos" ON public.promo_flashes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
