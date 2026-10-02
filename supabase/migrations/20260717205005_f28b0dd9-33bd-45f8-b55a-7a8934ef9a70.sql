
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  opened_role TEXT NOT NULL CHECK (opened_role IN ('buyer','seller')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and admins can view disputes"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = disputes.listing_id
        AND (l.buyer_id = auth.uid() OR l.seller_id = auth.uid())
    )
  );

CREATE POLICY "Admins can update disputes"
  ON public.disputes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_disputes_listing ON public.disputes(listing_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);

-- open_dispute
CREATE OR REPLACE FUNCTION public.open_dispute(_listing_id UUID, _reason TEXT)
RETURNS public.disputes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.listings; d public.disputes; role_val TEXT; admin_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Please describe the issue'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;

  IF auth.uid() = l.buyer_id THEN role_val := 'buyer';
  ELSIF auth.uid() = l.seller_id THEN role_val := 'seller';
  ELSE RAISE EXCEPTION 'Only trade participants can raise a dispute';
  END IF;

  IF EXISTS (SELECT 1 FROM public.disputes WHERE listing_id = _listing_id AND status = 'open') THEN
    RAISE EXCEPTION 'A dispute is already open for this trade';
  END IF;

  INSERT INTO public.disputes (listing_id, opened_by, opened_role, reason)
  VALUES (_listing_id, auth.uid(), role_val, _reason)
  RETURNING * INTO d;

  -- Notify opener (from Customer Care)
  INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
  VALUES (auth.uid(), _listing_id, 'dispute',
    'Dispute raised — ZiiDi Customer Care is reviewing',
    'Our customer care team is now reviewing your dispute for ' || l.quantity || ' × ' || l.ticker ||
    '. Please note: false claims or fraudulent activity may lead to permanent suspension of your account.');

  -- Notify counterparty (from Customer Care, no mention of admin)
  IF role_val = 'buyer' AND l.seller_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (l.seller_id, _listing_id, 'dispute',
      'Dispute filed against your trade',
      'ZiiDi Customer Care has been notified about the trade for ' || l.quantity || ' × ' || l.ticker ||
      '. Any attempt to withhold released shares after payment may lead to suspension of your account.');
  ELSIF role_val = 'seller' AND l.buyer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (l.buyer_id, _listing_id, 'dispute',
      'Dispute filed against your trade',
      'ZiiDi Customer Care has been notified about the trade for ' || l.quantity || ' × ' || l.ticker ||
      '. Marking payment as sent without actually paying may lead to permanent suspension of your account.');
  END IF;

  -- Notify all admins (internally)
  FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (admin_row.user_id, _listing_id, 'dispute',
      'New dispute opened',
      role_val || ' raised a dispute on ' || l.ticker || ' (listing ' || substring(_listing_id::text,1,8) || '). Review in Admin Panel.');
  END LOOP;

  RETURN d;
END; $$;

-- admin_resolve_dispute: _action = 'release' | 'refund' | 'dismiss'
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_id UUID, _action TEXT, _resolution TEXT)
RETURNS public.disputes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE d public.disputes; l public.listings; total NUMERIC; existing public.holdings; new_qty INT; new_avg NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = _id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF d.status <> 'open' THEN RAISE EXCEPTION 'Dispute already closed'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = d.listing_id FOR UPDATE;

  IF _action = 'release' THEN
    -- release shares to buyer (like admin_approve_payment)
    IF l.status IN ('pending','paid') THEN
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
      UPDATE public.listings SET status = 'sold' WHERE id = l.id;
    END IF;
    IF l.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.buyer_id, l.id, 'dispute',
        'Dispute resolved in your favour',
        'ZiiDi Customer Care has released ' || l.quantity || ' × ' || l.ticker || ' shares to your portfolio.');
    END IF;
  ELSIF _action = 'refund' THEN
    -- cancel listing back to active with no buyer
    IF l.status IN ('pending','paid') THEN
      UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL WHERE id = l.id;
    END IF;
    IF d.opened_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (d.opened_by, l.id, 'dispute',
        'Dispute resolved — trade cancelled',
        'ZiiDi Customer Care cancelled the trade for ' || l.quantity || ' × ' || l.ticker || '. If you had paid, contact support with proof of payment.');
    END IF;
  ELSIF _action = 'dismiss' THEN
    IF d.opened_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (d.opened_by, l.id, 'dispute',
        'Dispute reviewed by ZiiDi Customer Care',
        COALESCE(_resolution,'After review, no action was required. Repeated false disputes may lead to account suspension.'));
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  UPDATE public.disputes SET
    status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
    resolution = _resolution,
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  WHERE id = _id RETURNING * INTO d;

  RETURN d;
END; $$;

REVOKE EXECUTE ON FUNCTION public.open_dispute(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_dispute(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;
