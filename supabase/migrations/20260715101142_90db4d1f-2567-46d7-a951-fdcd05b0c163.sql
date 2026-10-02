
-- 1. Role enum + table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Restrict listing creation to admins (allow seller-from-holdings via SECURITY DEFINER RPC bypass)
DROP POLICY IF EXISTS "sellers create listings" ON public.listings;
CREATE POLICY "admins create listings" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'admin'));

-- 4. Admin approval RPC — approves paid trade, credits seller, moves shares to buyer portfolio
CREATE OR REPLACE FUNCTION public.admin_approve_payment(_listing_id uuid)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.listings;
  total numeric;
  existing public.holdings;
  new_qty integer;
  new_avg numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve payments';
  END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status <> 'paid' THEN RAISE EXCEPTION 'Trade is not awaiting approval'; END IF;

  total := l.quantity * l.price_per_share;
  UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;

  SELECT * INTO existing FROM public.holdings
    WHERE user_id = l.buyer_id AND ticker = l.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
      VALUES (l.buyer_id, l.ticker, l.company_name, l.quantity, l.price_per_share);
  ELSE
    new_qty := existing.quantity + l.quantity;
    new_avg := ((existing.quantity * existing.avg_price) + (l.quantity * l.price_per_share)) / new_qty;
    UPDATE public.holdings
      SET quantity = new_qty, avg_price = new_avg, updated_at = now()
      WHERE id = existing.id;
  END IF;

  UPDATE public.listings SET status = 'sold' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;

-- 5. Seed admin role for existing demo seller accounts
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email LIKE '%.demo@sharedesk.local'
ON CONFLICT (user_id, role) DO NOTHING;
