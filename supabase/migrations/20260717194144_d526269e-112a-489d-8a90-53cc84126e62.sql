CREATE POLICY "Admins manage stock logos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'stock-logos' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'stock-logos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated read stock logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stock-logos');