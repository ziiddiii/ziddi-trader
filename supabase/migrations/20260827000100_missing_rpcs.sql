CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_id uuid, _reason text)
RETURNS public.withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'Withdrawal not pending';
  END IF;
  UPDATE public.withdrawals SET status='rejected' WHERE id=_id RETURNING * INTO w;
  UPDATE public.profiles SET balance = balance + w.amount WHERE id = w.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (w.user_id, 'withdrawal', 'Withdrawal rejected',
      'Your withdrawal of KES ' || w.amount::text || ' was rejected. Reason: ' || COALESCE(_reason,'not specified') || '. The amount has been returned to your balance.');
  RETURN w;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_balance()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT balance FROM public.profiles WHERE id = auth.uid()), 0)
$$;

REVOKE ALL ON FUNCTION public.admin_reject_withdrawal(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_balance() TO authenticated;
