
CREATE TABLE public.autoinvest_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  min_amount numeric NOT NULL CHECK (min_amount > 0),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  return_percent numeric NOT NULL CHECK (return_percent >= 0),
  is_active boolean NOT NULL DEFAULT true,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoinvest_passkeys TO authenticated;
GRANT ALL ON public.autoinvest_passkeys TO service_role;
ALTER TABLE public.autoinvest_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage passkeys" ON public.autoinvest_passkeys FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view passkey they used" ON public.autoinvest_passkeys FOR SELECT
  USING (used_by = auth.uid());

CREATE TABLE public.autoinvests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passkey_id uuid REFERENCES public.autoinvest_passkeys(id) ON DELETE SET NULL,
  code text NOT NULL,
  principal numeric NOT NULL,
  return_percent numeric NOT NULL,
  duration_days integer NOT NULL,
  projected_return numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  matures_at timestamptz NOT NULL,
  matured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoinvests TO authenticated;
GRANT ALL ON public.autoinvests TO service_role;
ALTER TABLE public.autoinvests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own autoinvests" ON public.autoinvests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins see all autoinvests" ON public.autoinvests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_create_passkey(_code text, _min_amount numeric, _duration_days int, _return_percent numeric)
RETURNS public.autoinvest_passkeys LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.autoinvest_passkeys;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min_amount <= 0 OR _duration_days <= 0 OR _return_percent < 0 THEN RAISE EXCEPTION 'Invalid values'; END IF;
  INSERT INTO public.autoinvest_passkeys (code,min_amount,duration_days,return_percent,created_by)
  VALUES (upper(trim(_code)), _min_amount, _duration_days, _return_percent, auth.uid())
  RETURNING * INTO p;
  RETURN p;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_toggle_passkey(_id uuid, _active boolean)
RETURNS public.autoinvest_passkeys LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.autoinvest_passkeys;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.autoinvest_passkeys SET is_active = _active, updated_at = now() WHERE id = _id RETURNING * INTO p;
  RETURN p;
END; $$;

CREATE OR REPLACE FUNCTION public.start_autoinvest(_code text, _amount numeric)
RETURNS public.autoinvests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.autoinvest_passkeys;
  bal numeric;
  has_holdings boolean;
  a public.autoinvests;
  proj numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.holdings WHERE user_id = auth.uid()) INTO has_holdings;
  IF NOT has_holdings THEN RAISE EXCEPTION 'Buy at least one share to unlock Auto Invest'; END IF;

  SELECT * INTO p FROM public.autoinvest_passkeys WHERE code = upper(trim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid passkey'; END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Passkey is disabled'; END IF;
  IF _amount < p.min_amount THEN RAISE EXCEPTION 'Amount below passkey minimum (KES %)', p.min_amount; END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  proj := round((_amount * p.return_percent / 100.0)::numeric, 2);

  INSERT INTO public.autoinvests (user_id, passkey_id, code, principal, return_percent, duration_days, projected_return, matures_at)
  VALUES (auth.uid(), p.id, p.code, _amount, p.return_percent, p.duration_days, proj,
          now() + make_interval(days => p.duration_days))
  RETURNING * INTO a;

  UPDATE public.autoinvest_passkeys SET used_by = auth.uid(), used_at = now() WHERE id = p.id AND used_by IS NULL;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'autoinvest', 'Auto Invest started',
    'KES ' || _amount::text || ' auto-invested at ' || p.return_percent::text ||
    '% for ' || p.duration_days::text || ' day(s). Projected return KES ' || proj::text || '.');
  RETURN a;
END; $$;

CREATE OR REPLACE FUNCTION public.mature_autoinvest(_id uuid)
RETURNS public.autoinvests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.autoinvests; total numeric;
BEGIN
  SELECT * INTO a FROM public.autoinvests WHERE id = _id FOR UPDATE;
  IF a.id IS NULL OR a.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not found'; END IF;
  IF a.status <> 'active' THEN RAISE EXCEPTION 'Already matured'; END IF;
  IF now() < a.matures_at THEN RAISE EXCEPTION 'Not matured yet'; END IF;
  total := a.principal + a.projected_return;
  UPDATE public.profiles SET balance = balance + total WHERE id = auth.uid();
  UPDATE public.autoinvests SET status = 'matured', matured_at = now() WHERE id = _id RETURNING * INTO a;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'autoinvest', 'Auto Invest matured',
    'KES ' || total::text || ' credited (principal KES ' || a.principal::text || ' + return KES ' || a.projected_return::text || ').');
  RETURN a;
END; $$;
