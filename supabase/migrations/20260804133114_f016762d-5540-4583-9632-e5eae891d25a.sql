CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

-- Settings
CREATE TABLE public.deposit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_deposit numeric NOT NULL DEFAULT 25000,
  max_deposit numeric NOT NULL DEFAULT 2000000,
  paybill_number text NOT NULL DEFAULT '714777',
  account_number text NOT NULL DEFAULT '420200858228',
  business_name text NOT NULL DEFAULT 'SAFARICOM ZIIDI MMF',
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deposit_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_settings TO authenticated;
GRANT ALL ON public.deposit_settings TO service_role;
ALTER TABLE public.deposit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit_settings_read_all" ON public.deposit_settings FOR SELECT USING (true);
CREATE POLICY "deposit_settings_admin_write" ON public.deposit_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.deposit_settings (instructions) VALUES ('Use M-PESA Paybill to fund your ZiiDi account, then paste the M-PESA confirmation code below.');

-- Deposits
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  phone text NOT NULL,
  tx_ref text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deposits_user_idx ON public.deposits (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_select_own_or_admin" ON public.deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deposits_insert_own" ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "deposits_update_own_pending_or_admin" ON public.deposits FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND status = 'pending') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER deposit_settings_updated_at BEFORE UPDATE ON public.deposit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
ALTER TABLE public.deposits REPLICA IDENTITY FULL;

-- Approve
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(_id uuid)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO d FROM public.deposits WHERE id = _id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + d.amount WHERE id = d.user_id;
  UPDATE public.deposits SET status = 'approved', approved_at = now(), updated_at = now()
    WHERE id = _id RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit approved — account credited',
    'Your M-PESA deposit of KES ' || d.amount::text || ' has been confirmed and credited to your ZiiDi account balance.');
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_approve_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_deposit(uuid) TO authenticated;

-- Reject
CREATE OR REPLACE FUNCTION public.admin_reject_deposit(_id uuid, _note text DEFAULT NULL)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.deposits SET status = 'rejected', admin_note = _note, updated_at = now()
    WHERE id = _id AND status <> 'approved' RETURNING * INTO d;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found or already approved'; END IF;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit could not be confirmed',
    'We could not confirm your M-PESA deposit of KES ' || d.amount::text ||
    COALESCE('. Reason: ' || _note, '.') || ' Please contact ZiiDi customer care.');
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reject_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_deposit(uuid, text) TO authenticated;

-- Buying shares now settles from wallet balance with no prior-sale requirement
CREATE OR REPLACE FUNCTION public.buy_from_balance(_listing_id uuid, _quantity integer DEFAULT NULL)
RETURNS public.holdings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.listings;
  h public.holdings;
  existing public.holdings;
  total numeric;
  bal numeric;
  qty integer;
  new_qty integer;
  new_avg numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;

  qty := COALESCE(_quantity, src.quantity);
  IF qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  total := qty * src.price_per_share;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF COALESCE(bal,0) < total THEN
    RAISE EXCEPTION 'Insufficient balance. Deposit funds to buy (need KES %)', total;
  END IF;

  UPDATE public.profiles SET balance = balance - total WHERE id = auth.uid();

  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at)
  VALUES (src.ticker, src.company_name, qty, src.price_per_share, src.seller_id, auth.uid(), 'sold', now());

  SELECT * INTO existing FROM public.holdings
    WHERE user_id = auth.uid() AND ticker = src.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
    VALUES (auth.uid(), src.ticker, src.company_name, qty, src.price_per_share)
    RETURNING * INTO h;
  ELSE
    new_qty := existing.quantity + qty;
    new_avg := ((existing.quantity * existing.avg_price) + (qty * src.price_per_share)) / new_qty;
    UPDATE public.holdings SET quantity = new_qty, avg_price = new_avg, updated_at = now()
      WHERE id = existing.id RETURNING * INTO h;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'purchase', 'Shares purchased',
    qty || ' × ' || src.ticker || ' purchased from your ZiiDi balance for KES ' || total::text ||
    '. Shares are now in your portfolio, ready to resell.');

  RETURN h;
END;
$$;
REVOKE ALL ON FUNCTION public.buy_from_balance(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_from_balance(uuid, integer) TO authenticated;