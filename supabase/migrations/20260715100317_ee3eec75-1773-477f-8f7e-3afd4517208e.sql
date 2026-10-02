
ALTER TABLE public.profiles ALTER COLUMN balance SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.mark_paid(_listing_id uuid)
 RETURNS listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can confirm payment'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Listing not awaiting payment'; END IF;
  UPDATE public.listings SET status = 'paid' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $function$;
