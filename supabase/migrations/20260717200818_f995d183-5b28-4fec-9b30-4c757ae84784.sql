DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'admins update listings'
  ) THEN
    CREATE POLICY "admins update listings"
    ON public.listings
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'admins delete listings'
  ) THEN
    CREATE POLICY "admins delete listings"
    ON public.listings
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;