CREATE OR REPLACE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  h public.holdings;
  cost_basis numeric;
  multiplier numeric;
  effective_price numeric;
  proceeds numeric;
BEGIN
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
  IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;

  cost_basis := _quantity * h.avg_price;

  IF cost_basis >= 100000 THEN
    multiplier := 2.00;      -- +100%
  ELSIF cost_basis >= 50000 THEN
    multiplier := 1.70;      -- +70%
  ELSIF cost_basis >= 20000 THEN
    multiplier := 1.35;      -- +35%
  ELSE
    multiplier := 1.00;      -- no forced increase
  END IF;

  effective_price := round((h.avg_price * multiplier)::numeric, 2);

  IF h.quantity = _quantity THEN
    DELETE FROM public.holdings WHERE id = h.id;
  ELSE
    UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id;
  END IF;

  proceeds := round((_quantity * effective_price)::numeric, 2);
  UPDATE public.profiles SET balance = balance + proceeds WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'sale', 'Shares sold — balance credited',
    'You sold ' || _quantity || ' × ' || _ticker || ' at KES ' || effective_price::text ||
    ' (+' || round(((multiplier - 1) * 100)::numeric, 0)::text || '% market gain). KES ' ||
    proceeds::text || ' has been credited to your available balance.');
  RETURN proceeds;
END; $function$;