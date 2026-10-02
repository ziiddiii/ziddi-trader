ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS seller_name text, ADD COLUMN IF NOT EXISTS logo_url text;

CREATE OR REPLACE FUNCTION public.start_purchase(_listing_id uuid)
 RETURNS listings
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE src public.listings; l public.listings;
BEGIN
  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;
  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at, seller_name, logo_url)
  VALUES (src.ticker, src.company_name, src.quantity, src.price_per_share, src.seller_id, auth.uid(), 'pending', now(), src.seller_name, src.logo_url)
  RETURNING * INTO l;
  RETURN l;
END; $function$;