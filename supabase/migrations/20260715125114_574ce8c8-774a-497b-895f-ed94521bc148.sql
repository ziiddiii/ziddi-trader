
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS pending_at timestamptz;

CREATE OR REPLACE FUNCTION public.start_purchase(_listing_id uuid)
RETURNS listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings;
BEGIN
  UPDATE public.listings
     SET buyer_id = auth.uid(), status = 'pending', pending_at = now()
   WHERE id = _listing_id AND status = 'active' AND seller_id <> auth.uid()
   RETURNING * INTO l;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
  RETURN l;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_purchase(_listing_id uuid)
RETURNS listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF auth.uid() NOT IN (l.seller_id, l.buyer_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Cannot cancel'; END IF;
  UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL
   WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;

DROP FUNCTION IF EXISTS public.sell_from_holdings(text, integer, numeric);
CREATE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.holdings; proceeds numeric;
BEGIN
  IF _quantity <= 0 OR _price <= 0 THEN RAISE EXCEPTION 'Invalid quantity or price'; END IF;
  SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
  IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;
  IF h.quantity = _quantity THEN
    DELETE FROM public.holdings WHERE id = h.id;
  ELSE
    UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id;
  END IF;
  proceeds := _quantity * _price;
  UPDATE public.profiles SET balance = balance + proceeds WHERE id = auth.uid();
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'sale', 'Shares sold — balance credited',
    'You sold ' || _quantity || ' × ' || _ticker || ' at KES ' || _price::text ||
    '. KES ' || proceeds::text || ' has been credited to your available balance.');
  RETURN proceeds;
END; $$;

CREATE OR REPLACE FUNCTION public.expire_pending_and_notify()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; mins int; reminder_title text;
BEGIN
  FOR r IN SELECT * FROM public.listings
     WHERE status = 'pending' AND pending_at IS NOT NULL
       AND pending_at < now() - interval '10 minutes' LOOP
    UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL WHERE id = r.id;
    IF r.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (r.buyer_id, r.id, 'cancelled', 'Order auto-cancelled',
        'Your order for ' || r.quantity || ' × ' || r.ticker ||
        ' was cancelled automatically because payment was not completed within 10 minutes.');
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.listings
     WHERE status = 'pending' AND buyer_id IS NOT NULL AND pending_at IS NOT NULL LOOP
    mins := floor(extract(epoch FROM (now() - r.pending_at)) / 60)::int;
    IF mins IN (3, 6, 9) THEN
      reminder_title := 'Payment reminder (' || mins || ' min)';
      IF NOT EXISTS (SELECT 1 FROM public.notifications
         WHERE user_id = r.buyer_id AND listing_id = r.id AND title = reminder_title) THEN
        INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
        VALUES (r.buyer_id, r.id, 'reminder', reminder_title,
          'Please complete payment for ' || r.quantity || ' × ' || r.ticker ||
          '. Your order will auto-cancel in ' || (10 - mins) || ' minute(s).');
      END IF;
    END IF;
  END LOOP;
END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-and-remind-orders') THEN
    PERFORM cron.unschedule('expire-and-remind-orders');
  END IF;
  PERFORM cron.schedule('expire-and-remind-orders', '* * * * *',
    'SELECT public.expire_pending_and_notify()');
END $$;
