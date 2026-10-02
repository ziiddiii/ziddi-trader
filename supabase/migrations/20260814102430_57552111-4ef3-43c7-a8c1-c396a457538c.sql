ALTER TABLE public.deposit_settings
  ADD COLUMN IF NOT EXISTS mobile_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS crypto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crypto_kes_per_usd numeric NOT NULL DEFAULT 130;

CREATE OR REPLACE FUNCTION public.settle_crypto_deposit(_payment_id text, _receipt text DEFAULT NULL::text)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _payment_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found for payment %', _payment_id; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + d.amount WHERE id = d.user_id;

  UPDATE public.deposits
     SET status = 'approved',
         approved_at = now(),
         updated_at = now(),
         tx_ref = COALESCE(NULLIF(_receipt, ''), tx_ref)
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Crypto deposit confirmed — account credited',
    'Your crypto deposit of KES ' || d.amount::text || ' was confirmed on-chain and credited to your ZiiDi account balance.');

  RETURN d;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_crypto_deposit(_payment_id text, _reason text DEFAULT NULL::text)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits;
BEGIN
  UPDATE public.deposits
     SET status = 'failed', admin_note = COALESCE(_reason, admin_note), updated_at = now()
   WHERE checkout_request_id = _payment_id AND status = 'pending'
   RETURNING * INTO d;
  RETURN d;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_crypto_deposit(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_crypto_deposit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_crypto_deposit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_crypto_deposit(text, text) TO service_role;