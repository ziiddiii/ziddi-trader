
CREATE OR REPLACE FUNCTION public.buy_bond(_bond_type text)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  ticker_code text;
  company text;
  amount numeric;
  l public.listings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF _bond_type = 'fixed' THEN
    ticker_code := 'FXD-BOND'; company := 'Fixed Coupon Bond (1–30 yrs, semi-annual)'; amount := 100000;
  ELSIF _bond_type = 'infra' THEN
    ticker_code := 'IFB-BOND'; company := 'Infrastructure Bond (5–25 yrs @ 15%)'; amount := 250000;
  ELSIF _bond_type = 'zero' THEN
    ticker_code := 'ZCB-BOND'; company := 'Zero-Coupon Bond (@15%, sell anytime)'; amount := 50000;
  ELSE
    RAISE EXCEPTION 'Unknown bond type';
  END IF;

  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin'
    AND user_id <> auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  END IF;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Bond desk unavailable'; END IF;

  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, status, seller_id, buyer_id, pending_at)
  VALUES (ticker_code, company, 1, amount, 'pending', admin_id, auth.uid(), now())
  RETURNING * INTO l;

  RETURN l;
END; $$;

GRANT EXECUTE ON FUNCTION public.buy_bond(text) TO authenticated;
