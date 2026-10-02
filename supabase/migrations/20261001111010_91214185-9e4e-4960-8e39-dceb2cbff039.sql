CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_id uuid)
 RETURNS withdrawals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'Withdrawal not pending';
  END IF;

  UPDATE public.withdrawals SET status='completed' WHERE id=_id RETURNING * INTO w;
  RETURN w;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_approve_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid) TO authenticated;