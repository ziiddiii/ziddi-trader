GRANT SELECT ON public.stock_settings TO anon;
CREATE POLICY "Public can read stock settings" ON public.stock_settings FOR SELECT TO anon USING (true);