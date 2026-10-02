-- 1. listings: restrict broad SELECT
DROP POLICY IF EXISTS "listings visible to authenticated" ON public.listings;
CREATE POLICY "listings marketplace or participant read"
ON public.listings FOR SELECT TO authenticated
USING (
  (status = 'active' AND buyer_id IS NULL)
  OR auth.uid() = seller_id
  OR auth.uid() = buyer_id
  OR public.has_role(auth.uid(), 'admin')
);

-- 2. settings tables: authenticated-only reads
DROP POLICY IF EXISTS "deposit_settings_read_all" ON public.deposit_settings;
CREATE POLICY "deposit_settings_read_authenticated"
ON public.deposit_settings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.deposit_settings FROM anon;

DROP POLICY IF EXISTS "Anyone can read lock settings" ON public.lock_settings;
CREATE POLICY "Authenticated can read lock settings"
ON public.lock_settings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.lock_settings FROM anon;

DROP POLICY IF EXISTS "Anyone can read stock settings" ON public.stock_settings;
CREATE POLICY "Authenticated can read stock settings"
ON public.stock_settings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.stock_settings FROM anon;

DROP POLICY IF EXISTS "Anyone can read enabled promos" ON public.promo_flashes;
CREATE POLICY "Authenticated can read enabled promos"
ON public.promo_flashes FOR SELECT TO authenticated USING (enabled = true);
REVOKE ALL ON public.promo_flashes FROM anon;

-- 3. autoinvest_passkeys: authenticated-only, strictly own
DROP POLICY IF EXISTS "Users can view passkey they used" ON public.autoinvest_passkeys;
CREATE POLICY "Users can view passkey they used"
ON public.autoinvest_passkeys FOR SELECT TO authenticated
USING (used_by IS NOT NULL AND used_by = auth.uid());
DROP POLICY IF EXISTS "Admins manage passkeys" ON public.autoinvest_passkeys;
CREATE POLICY "Admins manage passkeys"
ON public.autoinvest_passkeys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.autoinvest_passkeys FROM anon;

-- lock_settings admin policies scoped to authenticated
DROP POLICY IF EXISTS "Admins insert lock settings" ON public.lock_settings;
CREATE POLICY "Admins insert lock settings"
ON public.lock_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update lock settings" ON public.lock_settings;
CREATE POLICY "Admins update lock settings"
ON public.lock_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage stock settings" ON public.stock_settings;
CREATE POLICY "Admins manage stock settings"
ON public.stock_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. withdrawals: explicit admin UPDATE, no DELETE for anyone
CREATE POLICY "admins update withdrawals"
ON public.withdrawals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE DELETE ON public.withdrawals FROM authenticated, anon;
REVOKE ALL ON public.withdrawals FROM anon;

-- 5. SECURITY DEFINER function execute privileges
REVOKE ALL ON FUNCTION public.guard_not_suspended() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_stk_deposit(text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stk_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_pending_and_notify() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_tax_settings(numeric, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_tax_settings(numeric, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_tax_settings(numeric, text, text, text, text, text, text, numeric, numeric) FROM PUBLIC, anon;