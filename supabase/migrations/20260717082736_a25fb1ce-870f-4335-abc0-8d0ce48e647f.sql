
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tax_paid_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_tax_paid(_id uuid)
RETURNS public.withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w public.withdrawals; admin_row record;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;

  UPDATE public.withdrawals SET tax_paid_at = COALESCE(tax_paid_at, now())
    WHERE id = _id RETURNING * INTO w;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (w.user_id, 'withdrawal', 'MMF tax payment recorded',
    'Your ' || w.method || ' withdrawal of KES ' || w.amount::text ||
    ' is now awaiting final admin approval. Funds will be released shortly.');

  FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (admin_row.user_id, 'withdrawal', 'Tax paid — withdrawal ready for release',
      'User confirmed MMF tax for ' || w.method || ' withdrawal of KES ' || w.amount::text ||
      '. Approve to release funds.');
  END LOOP;

  RETURN w;
END; $$;

REVOKE ALL ON FUNCTION public.mark_withdrawal_tax_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_tax_paid(uuid) TO authenticated;
