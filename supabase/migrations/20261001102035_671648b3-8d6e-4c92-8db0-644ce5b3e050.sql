CREATE POLICY "Anyone can read enabled promos"
ON public.promo_flashes
FOR SELECT
TO anon, authenticated
USING (enabled = true);