UPDATE public.withdrawals
SET status = 'completed',
    tax_paid_at = COALESCE(tax_paid_at, now())
WHERE id = '64e400ca-ba7e-49d6-822a-4c5dbe0dc58a';

INSERT INTO public.notifications (user_id, kind, title, body)
SELECT w.user_id, 'withdrawal', 'Withdrawal approved',
  'KES ' || w.amount::text || ' has been released to your ' || w.method || ' destination after MMF tax confirmation.'
FROM public.withdrawals w
WHERE w.id = '64e400ca-ba7e-49d6-822a-4c5dbe0dc58a';