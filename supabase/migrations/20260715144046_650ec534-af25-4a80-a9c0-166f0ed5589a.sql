
CREATE TABLE public.investment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_amount NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investment_plans TO authenticated;
GRANT ALL ON public.investment_plans TO service_role;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view plans" ON public.investment_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plans" ON public.investment_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.investment_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  duration_hours INTEGER NOT NULL,
  expected_return NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matures_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own investments" ON public.investments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own investments" ON public.investments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update investments" ON public.investments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.investment_plans (name, description, interest_rate, duration_hours, min_amount, max_amount, sort_order) VALUES
('Btcfx Starter Plan', 'The BTCFX Starter Plan is designed for investors seeking a simple, low-entry way to grow capital with a predictable short-term return.', 100, 24, 35000, 250000, 1),
('Btcfx Premium Plan', 'The BTCFX Premium Plan is designed for investors seeking a simple, balanced way to grow capital with strong short-term returns.', 120, 48, 75000, 500000, 2),
('BtcFx Vip Plan', 'The BTCFX VIP Plan is designed for investors seeking a simple and high-yield investment vehicle for larger capital allocations.', 150, 72, 150000, 2000000, 3);
