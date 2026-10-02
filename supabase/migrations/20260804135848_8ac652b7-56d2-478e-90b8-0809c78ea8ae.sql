ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS change_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_buy_amount numeric;

ALTER TABLE public.stock_settings
  ADD COLUMN IF NOT EXISTS default_min_buy numeric NOT NULL DEFAULT 25000;

CREATE OR REPLACE FUNCTION public.admin_update_stock_settings(_min numeric, _max numeric, _default_min_buy numeric)
RETURNS stock_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s public.stock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min <= 0 OR _max <= 0 OR _min > _max THEN RAISE EXCEPTION 'Invalid range'; END IF;
  IF _default_min_buy <= 0 THEN RAISE EXCEPTION 'Invalid minimum buy amount'; END IF;

  SELECT * INTO s FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NULL THEN
    INSERT INTO public.stock_settings (min_total, max_total, default_min_buy, updated_by)
    VALUES (_min, _max, _default_min_buy, auth.uid()) RETURNING * INTO s;
  ELSE
    UPDATE public.stock_settings
      SET min_total = _min, max_total = _max, default_min_buy = _default_min_buy,
          updated_at = now(), updated_by = auth.uid()
      WHERE id = s.id RETURNING * INTO s;
  END IF;
  RETURN s;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_stock_settings(numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_stock_settings(numeric, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_from_balance(_listing_id uuid, _quantity integer DEFAULT NULL::integer)
RETURNS holdings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  min_buy numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;

  qty := COALESCE(_quantity, src.quantity);
  IF qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  total := qty * src.price_per_share;

  SELECT COALESCE(src.min_buy_amount, s.default_min_buy, 25000) INTO min_buy
  FROM (SELECT default_min_buy FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1) s;
  min_buy := COALESCE(min_buy, COALESCE(src.min_buy_amount, 25000));
  IF total < min_buy THEN
    RAISE EXCEPTION 'Minimum buy for % is KES %. Increase the number of shares.', src.ticker, round(min_buy,2);
  END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF COALESCE(bal,0) < total THEN
    RAISE EXCEPTION 'Insufficient balance. Deposit funds to buy (need KES %)', total;
  END IF;

  UPDATE public.profiles SET balance = balance - total WHERE id = auth.uid();

  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at, logo_url, seller_name)
  VALUES (src.ticker, src.company_name, qty, src.price_per_share, src.seller_id, auth.uid(), 'sold', now(), src.logo_url, src.seller_name);

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
END; $$;