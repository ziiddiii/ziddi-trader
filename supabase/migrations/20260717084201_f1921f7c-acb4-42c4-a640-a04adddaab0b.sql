GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

DROP POLICY IF EXISTS "admins can read all withdrawals" ON public.withdrawals;
CREATE POLICY "admins can read all withdrawals"
ON public.withdrawals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

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
  IF w.tax_paid_at IS NULL THEN
    RAISE EXCEPTION 'MMF tax must be marked paid before approving this withdrawal';
  END IF;

  UPDATE public.withdrawals SET status='completed' WHERE id=_id RETURNING * INTO w;

  INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (w.user_id, 'withdrawal', 'Withdrawal approved',
      'KES ' || w.amount::text || ' has been released to your ' || w.method || ' destination after MMF tax confirmation.');
  RETURN w;
END; $function$;