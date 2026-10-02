
-- Holdings table: buyer's portfolio of purchased shares
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holdings read" ON public.holdings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own holdings write" ON public.holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Withdrawals
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Update release_shares to also credit buyer's holdings
CREATE OR REPLACE FUNCTION public.release_shares(_listing_id uuid)
RETURNS listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings; total NUMERIC; existing public.holdings; new_qty INTEGER; new_avg NUMERIC;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Only the seller can release'; END IF;
  IF l.status <> 'paid' THEN RAISE EXCEPTION 'Payment not received yet'; END IF;
  total := l.quantity * l.price_per_share;
  UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;

  SELECT * INTO existing FROM public.holdings WHERE user_id = l.buyer_id AND ticker = l.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
      VALUES (l.buyer_id, l.ticker, l.company_name, l.quantity, l.price_per_share);
  ELSE
    new_qty := existing.quantity + l.quantity;
    new_avg := ((existing.quantity * existing.avg_price) + (l.quantity * l.price_per_share)) / new_qty;
    UPDATE public.holdings SET quantity = new_qty, avg_price = new_avg, updated_at = now() WHERE id = existing.id;
  END IF;

  UPDATE public.listings SET status = 'sold' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;

-- Sell from portfolio: decrement holdings and create active listing
CREATE OR REPLACE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric)
RETURNS listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.holdings; l public.listings;
BEGIN
  IF _quantity <= 0 OR _price <= 0 THEN RAISE EXCEPTION 'Invalid quantity or price'; END IF;
  SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
  IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;

  IF h.quantity = _quantity THEN
    DELETE FROM public.holdings WHERE id = h.id;
  ELSE
    UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id;
  END IF;

  INSERT INTO public.listings (seller_id, ticker, company_name, quantity, price_per_share, status)
    VALUES (auth.uid(), _ticker, h.company_name, _quantity, _price, 'active')
  RETURNING * INTO l;
  RETURN l;
END; $$;

-- Withdraw funds
CREATE OR REPLACE FUNCTION public.withdraw_funds(_amount numeric, _method text, _destination text)
RETURNS withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal NUMERIC; w public.withdrawals;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _method NOT IN ('mpesa','bank','card') THEN RAISE EXCEPTION 'Unsupported method'; END IF;
  IF length(coalesce(_destination,'')) < 3 THEN RAISE EXCEPTION 'Destination required'; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.withdrawals (user_id, amount, method, destination, status)
    VALUES (auth.uid(), _amount, _method, _destination, 'processing')
  RETURNING * INTO w;
  RETURN w;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.holdings;
