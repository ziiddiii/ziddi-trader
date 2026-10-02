
CREATE OR REPLACE FUNCTION public.buy_from_balance(_listing_id uuid, _quantity integer)
RETURNS public.holdings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  src public.listings;
  h public.holdings;
  existing public.holdings;
  total numeric;
  bal numeric;
  qty integer;
  has_sold boolean;
  new_qty integer;
  new_avg numeric;
  clone public.listings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = auth.uid() AND kind = 'sale'
  ) INTO has_sold;
  IF NOT has_sold THEN
    RAISE EXCEPTION 'Instant buy unlocks after your first share sale';
  END IF;

  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;

  qty := COALESCE(_quantity, src.quantity);
  IF qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  total := qty * src.price_per_share;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < total THEN RAISE EXCEPTION 'Insufficient balance (need KES %)', total; END IF;

  UPDATE public.profiles SET balance = balance - total WHERE id = auth.uid();
  UPDATE public.profiles SET balance = balance + total WHERE id = src.seller_id;

  -- Record a completed listing row for audit/history
  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at)
  VALUES (src.ticker, src.company_name, qty, src.price_per_share, src.seller_id, auth.uid(), 'sold', now())
  RETURNING * INTO clone;

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
  VALUES (auth.uid(), 'purchase', 'Instant buy successful',
    qty || ' × ' || src.ticker || ' purchased instantly from your balance for KES ' || total::text ||
    '. Shares added to your portfolio.');

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (src.seller_id, 'sale', 'Shares sold via instant buy',
    'A buyer instantly purchased ' || qty || ' × ' || src.ticker ||
    ' from your listing. KES ' || total::text || ' credited to your balance.');

  RETURN h;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.buy_from_balance(uuid, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_from_balance(uuid, integer) TO authenticated;
