CREATE OR REPLACE FUNCTION public.settle_stk_deposit(_checkout_request_id text, _receipt text DEFAULT NULL, _amount numeric DEFAULT NULL)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found for checkout %', _checkout_request_id; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + COALESCE(_amount, d.amount) WHERE id = d.user_id;

  UPDATE public.deposits
     SET status = 'approved',
         approved_at = now(),
         updated_at = now(),
         mpesa_receipt = COALESCE(NULLIF(_receipt, ''), mpesa_receipt),
         tx_ref = COALESCE(NULLIF(_receipt, ''), tx_ref),
         amount = COALESCE(_amount, amount)
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit confirmed — account credited',
    'Your M-PESA deposit of KES ' || d.amount::text || ' was confirmed automatically and credited to your ZiiDi account balance.');

  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_stk_deposit(text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stk_deposit(text, text, numeric) TO service_role;