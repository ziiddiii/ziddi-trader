
-- Settings (singleton row)
CREATE TABLE public.lock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_amount numeric NOT NULL DEFAULT 100,
  max_amount numeric NOT NULL DEFAULT 10000000,
  lock_period_hours integer NOT NULL DEFAULT 24,
  daily_rate numeric NOT NULL DEFAULT 0.07,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lock_settings TO authenticated, anon;
GRANT ALL ON public.lock_settings TO service_role;
ALTER TABLE public.lock_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read lock settings" ON public.lock_settings FOR SELECT USING (true);
CREATE POLICY "Admins update lock settings" ON public.lock_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert lock settings" ON public.lock_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.lock_settings (min_amount, max_amount, lock_period_hours, daily_rate)
VALUES (100, 10000000, 24, 0.07);

-- Deposits
CREATE TABLE public.lock_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  principal numeric NOT NULL CHECK (principal > 0),
  daily_rate numeric NOT NULL,
  lock_period_hours integer NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  unlock_at timestamptz NOT NULL,
  released_at timestamptz,
  interest_credited numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lock_deposits TO authenticated;
GRANT ALL ON public.lock_deposits TO service_role;
ALTER TABLE public.lock_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own locks" ON public.lock_deposits FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own locks" ON public.lock_deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX lock_deposits_user_idx ON public.lock_deposits(user_id, status);

-- Lock funds
CREATE OR REPLACE FUNCTION public.lock_funds(_amount numeric)
RETURNS lock_deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.lock_settings; bal numeric; d public.lock_deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM public.lock_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Lock is not configured'; END IF;
  IF _amount < s.min_amount THEN RAISE EXCEPTION 'Minimum lock is KES %', s.min_amount; END IF;
  IF _amount > s.max_amount THEN RAISE EXCEPTION 'Maximum lock is KES %', s.max_amount; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.lock_deposits (user_id, principal, daily_rate, lock_period_hours, unlock_at)
  VALUES (auth.uid(), _amount, s.daily_rate, s.lock_period_hours,
          now() + make_interval(hours => s.lock_period_hours))
  RETURNING * INTO d;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'lock', 'Funds locked in ZiiDi Lock',
    'KES ' || _amount::text || ' locked at ' || (s.daily_rate*100)::text ||
    '% daily. Unlocks at ' || to_char(d.unlock_at, 'YYYY-MM-DD HH24:MI') || '.');
  RETURN d;
END; $$;

-- Unlock funds (with accrued interest)
CREATE OR REPLACE FUNCTION public.unlock_funds(_lock_id uuid)
RETURNS lock_deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.lock_deposits; days numeric; interest numeric; total numeric;
BEGIN
  SELECT * INTO d FROM public.lock_deposits WHERE id = _lock_id FOR UPDATE;
  IF d.id IS NULL OR d.user_id <> auth.uid() THEN RAISE EXCEPTION 'Lock not found'; END IF;
  IF d.status <> 'active' THEN RAISE EXCEPTION 'Already released'; END IF;
  IF now() < d.unlock_at THEN RAISE EXCEPTION 'Funds are still locked until %', to_char(d.unlock_at,'YYYY-MM-DD HH24:MI'); END IF;
  days := extract(epoch FROM (now() - d.locked_at)) / 86400.0;
  interest := round((d.principal * d.daily_rate * days)::numeric, 2);
  total := d.principal + interest;
  UPDATE public.profiles SET balance = balance + total WHERE id = auth.uid();
  UPDATE public.lock_deposits
    SET status = 'released', released_at = now(), interest_credited = interest
    WHERE id = _lock_id RETURNING * INTO d;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'unlock', 'ZiiDi Lock released',
    'KES ' || total::text || ' credited to your balance (principal KES ' || d.principal::text ||
    ' + interest KES ' || interest::text || ').');
  RETURN d;
END; $$;

-- Admin update settings
CREATE OR REPLACE FUNCTION public.admin_update_lock_settings(
  _min_amount numeric, _max_amount numeric, _lock_period_hours integer, _daily_rate numeric
) RETURNS lock_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.lock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min_amount <= 0 OR _max_amount <= 0 OR _max_amount < _min_amount THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
  IF _lock_period_hours < 1 THEN RAISE EXCEPTION 'Lock period must be at least 1 hour'; END IF;
  IF _daily_rate < 0 OR _daily_rate > 1 THEN RAISE EXCEPTION 'Daily rate must be 0-1'; END IF;
  UPDATE public.lock_settings SET
    min_amount = _min_amount, max_amount = _max_amount,
    lock_period_hours = _lock_period_hours, daily_rate = _daily_rate,
    updated_at = now()
  RETURNING * INTO s;
  RETURN s;
END; $$;
