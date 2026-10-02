CREATE OR REPLACE FUNCTION public.open_dispute(_listing_id uuid, _reason text)
 RETURNS disputes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l public.listings; d public.disputes; role_val TEXT; admin_row RECORD; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Please describe the issue'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;

  SELECT public.has_role(auth.uid(),'admin') INTO is_admin;

  IF auth.uid() = l.buyer_id THEN role_val := 'buyer';
  ELSIF auth.uid() = l.seller_id THEN role_val := 'seller';
  ELSIF is_admin THEN role_val := 'seller';  -- admin acts on behalf of seller silently
  ELSE RAISE EXCEPTION 'Only trade participants can raise a dispute';
  END IF;

  IF EXISTS (SELECT 1 FROM public.disputes WHERE listing_id = _listing_id AND status = 'open') THEN
    RAISE EXCEPTION 'A dispute is already open for this trade';
  END IF;

  INSERT INTO public.disputes (listing_id, opened_by, opened_role, reason)
  VALUES (_listing_id, auth.uid(), role_val, _reason)
  RETURNING * INTO d;

  -- If admin raised it on behalf of seller, notify buyer as ZiiDi Customer Care (no admin mention)
  -- and do NOT notify the "opener" (admin) with a customer-facing message.
  IF is_admin AND auth.uid() <> l.buyer_id AND auth.uid() <> l.seller_id THEN
    IF l.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.buyer_id, _listing_id, 'dispute',
        'Trade under review by ZiiDi Customer Care',
        'Your trade for ' || l.quantity || ' × ' || l.ticker ||
        ' is under review. If payment was marked sent without actually paying, this may lead to permanent suspension of your account.');
    END IF;
  ELSE
    -- Normal participant flow: notify opener + counterparty
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (auth.uid(), _listing_id, 'dispute',
      'Dispute raised — ZiiDi Customer Care is reviewing',
      'Our customer care team is now reviewing your dispute for ' || l.quantity || ' × ' || l.ticker ||
      '. Please note: false claims or fraudulent activity may lead to permanent suspension of your account.');

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
  END IF;

  -- Notify all admins internally
  FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (admin_row.user_id, _listing_id, 'dispute',
      'New dispute opened',
      role_val || ' raised a dispute on ' || l.ticker || ' (listing ' || substring(_listing_id::text,1,8) || '). Review in Admin Panel.');
  END LOOP;

  RETURN d;
END; $function$;