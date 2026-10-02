ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS checkout_request_id text,
  ADD COLUMN IF NOT EXISTS merchant_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS deposits_checkout_request_id_key
  ON public.deposits (checkout_request_id) WHERE checkout_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.settle_stk_deposit(_checkout_request_id text, _receipt text, _amount numeric DEFAULT NULL)
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
         mpesa_receipt = _receipt,
         tx_ref = COALESCE(_receipt, tx_ref),
         amount = COALESCE(_amount, amount)
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit confirmed — account credited',
    'Your M-PESA deposit of KES ' || d.amount::text || ' (receipt ' || COALESCE(_receipt,'-') ||
    ') was confirmed automatically and credited to your ZiiDi account balance.');

  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_stk_deposit(_checkout_request_id text, _reason text)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF d.id IS NULL THEN RETURN NULL; END IF;
  IF d.status <> 'pending' THEN RETURN d; END IF;

  UPDATE public.deposits
     SET status = 'rejected', admin_note = COALESCE(_reason, 'M-PESA payment was not completed'), updated_at = now()
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit not completed',
    'Your M-PESA deposit of KES ' || d.amount::text || ' was not completed: ' ||
    COALESCE(_reason, 'the payment prompt was cancelled or timed out') || '. You can try again.');

  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_stk_deposit(text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stk_deposit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stk_deposit(text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stk_deposit(text, text) TO service_role;